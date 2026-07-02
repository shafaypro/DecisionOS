# Operations runbook - DecisionOS on AWS ECS

Day-2 tasks. All commands run from `deploy/aws-ecs/` unless noted. Helpers:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
REGION=$(terraform output -raw ecr_repository_url | cut -d. -f4)
```

## Deploy a new version

```bash
./scripts/build-and-push.sh            # or scripts/build-and-push.ps1 on Windows
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION"
```

The script builds the repo-root Dockerfile, pushes `:latest` + `:sha-<commit>`, and
forces a rolling deployment. With `desired_count = 1` there's a brief gap while the old
task drains; set `desired_count ≥ 2` (after the migration change below) for zero-downtime.

## Roll back

Re-deploy a previous image tag:

```bash
ECR=$(terraform output -raw ecr_repository_url)
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
  --task-definition "$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
     --query 'services[0].taskDefinition' --output text)" \
  --force-new-deployment --region "$REGION"
# To pin an explicit older image, set container_image = "<ecr>:sha-<oldcommit>" in
# terraform.tfvars and `terraform apply` (creates a new task def revision).
```

Because the task definition tracks `:latest`, the durable way to roll back is to push the
known-good commit again (`git checkout <sha> -- . && ./scripts/build-and-push.sh`) or pin
`container_image` to a `sha-` tag and apply.

## View logs

```bash
aws logs tail "$(terraform output -raw log_group)" --follow --region "$REGION"
```

Logs are structured JSON (the app's `src/lib/logger.ts`). Filter, e.g. errors only:

```bash
aws logs tail "$(terraform output -raw log_group)" --region "$REGION" \
  --filter-pattern '{ $.level = "error" }'
```

## Scale out (and fix migrations first)

Migrations currently run on **every** task start (Dockerfile `CMD`), so starting two
tasks at once would race. Before raising `desired_count`:

1. Run migrations as a one-off task instead:
   ```bash
   aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE \
     --task-definition "$SERVICE" \
     --overrides '{"containerOverrides":[{"name":"decisionos-prod","command":["npm","run","db:migrate:deploy"]}]}' \
     --network-configuration "awsvpcConfiguration={subnets=[<public-subnet-ids>],securityGroups=[<ecs-sg>],assignPublicIp=ENABLED}" \
     --region "$REGION"
   ```
2. Change the Dockerfile `CMD` to `npm run start` only (drop the migrate step).
3. Add this to `ecs.tf` and apply:
   ```hcl
   resource "aws_appautoscaling_target" "ecs" {
     max_capacity       = 4
     min_capacity       = 2
     resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"
     scalable_dimension = "ecs:service:DesiredCount"
     service_namespace  = "ecs"
   }
   # + an aws_appautoscaling_policy on CPU/ALB request count.
   ```
4. Set `desired_count = 2`, `terraform apply`.

## Connect to the database

RDS is private. Use SSM Session Manager port-forwarding through the running task, or a
small bastion. Quick path via the ECS task (it can reach RDS):

```bash
# one-off psql from a Fargate task
aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE \
  --task-definition "$SERVICE" \
  --overrides '{"containerOverrides":[{"name":"decisionos-prod","command":["sh","-c","npx prisma studio || sleep 60"]}]}' \
  --network-configuration "awsvpcConfiguration={subnets=[<public-subnets>],securityGroups=[<ecs-sg>],assignPublicIp=ENABLED}" \
  --region "$REGION"
```

For interactive access prefer a bastion host or RDS via a VPN/SSM tunnel. The
`DATABASE_URL` (with password) lives in Secrets Manager:

```bash
aws secretsmanager get-secret-value --secret-id decisionos-prod/DATABASE_URL \
  --query SecretString --output text --region "$REGION"
```

## Back up / restore the database

- RDS automated backups are on (`backup_retention_period = 7`). Restore via console or:
  ```bash
  aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier decisionos-prod-pg \
    --target-db-instance-identifier decisionos-prod-pg-restore \
    --restore-time <ISO8601> --region "$REGION"
  ```
- Take a manual snapshot before risky migrations:
  ```bash
  aws rds create-db-snapshot --db-instance-identifier decisionos-prod-pg \
    --db-snapshot-identifier pre-migration-$(date +%Y%m%d) --region "$REGION"
  ```

## Rotate secrets

- **`SESSION_SECRET` - do NOT rotate casually.** It encrypts session JWTs *and* the
  AES-256-GCM integration secrets (Slack/SSO) stored in the DB. Rotating it logs everyone
  out and makes stored integration secrets unreadable. If you must, plan a re-encryption
  of `WorkspaceIntegration.configJson` / `SlackWorkspaceLink.slackBotToken` /
  `WorkspaceSsoConfig.clientSecretEnc`.
- **DB password / `DATABASE_URL`** can be rotated: update the RDS password, update the
  `DATABASE_URL` secret value, then force a new deployment.
- **`CRON_SECRET`** can be rotated freely; update the secret and (if using EventBridge)
  the connection, then redeploy.

## Update environment / sizing

Edit `terraform.tfvars` (e.g. `task_cpu`, `task_memory`, `DATABASE_POOL_MAX` via the
task def, `db_instance_class`) and `terraform apply`. A changed task definition rolls out
on apply (the service tracks the latest revision).

## Adding HTTPS + a custom domain

The resources already exist in `optional-https.tf`, disabled. To enable:

1. Move/buy the domain (Route 53 hosted zone is easiest).
2. Request an **ACM certificate in this region** for the domain; complete DNS validation.
3. In `terraform.tfvars`:
   ```hcl
   acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/abc-123"
   domain_name         = "decisions.yourcompany.com"
   route53_zone_id     = "Z0123..."   # optional; omit to manage DNS yourself
   ```
4. `terraform apply` - adds the `:443` listener, flips `:80` to redirect, and (if zone set)
   creates the alias record.
5. **Rebuild the image** so `NEXT_PUBLIC_APP_URL` (now your https domain) is inlined:
   `./scripts/build-and-push.sh`.

## Enabling scheduled cron jobs

Requires HTTPS (above), because EventBridge API destinations need an HTTPS endpoint.
Then set `enable_scheduled_jobs = true` and `terraform apply`. This creates EventBridge
rules that POST to `/api/cron/review-reminders` (daily) and `/api/cron/weekly-digest`
(weekly) with the `CRON_SECRET`. Adjust timing with `review_reminders_schedule` /
`weekly_digest_schedule`. See `optional-scheduled-jobs.tf`.

## Remote state (before sharing with a team)

Local state holds secrets and isn't safe to commit or share. Add an S3 backend:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "your-tf-state-bucket"
    key            = "decisionos/ecs/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```
Then `terraform init -migrate-state`.

## Tear down

```bash
terraform destroy
```

`skip_final_snapshot = true`, `deletion_protection = false`, and ECR `force_delete = true`
are set for easy teardown. **Flip all three before holding real data** (`database.tf`,
`ecr.tf`).
