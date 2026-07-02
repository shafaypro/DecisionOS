# Troubleshooting - DecisionOS on AWS ECS

Helpers:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
SERVICE=$(terraform output -raw ecs_service_name)
REGION=$(terraform output -raw ecr_repository_url | cut -d. -f4)
LOGS=$(terraform output -raw log_group)
```

Start every investigation with the service events and the last task's stop reason:

```bash
aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" \
  --query 'services[0].events[0:5].message'

# most recent stopped task + why it stopped
TASK=$(aws ecs list-tasks --cluster "$CLUSTER" --desired-status STOPPED \
  --region "$REGION" --query 'taskArns[0]' --output text)
aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" --region "$REGION" \
  --query 'tasks[0].{stopped:stoppedReason,containers:containers[].reason}'
```

---

## First apply: no task is running

**Expected.** On the first `terraform apply` the ECS service exists but there's no image
in ECR yet, so the task can't start. Run `./scripts/build-and-push.sh`, then
`aws ecs wait services-stable ...`.

## Task stuck PENDING → STOPPED with "CannotPullContainerError"

The task can't reach ECR.
- Confirm an image exists: `aws ecr list-images --repository-name decisionos-prod --region "$REGION"`.
- Confirm `assign_public_ip = true` (it is, in `ecs.tf`) - without a public IP and without
  NAT, the task can't pull. If you moved tasks to private subnets, add NAT or VPC endpoints
  for `ecr.api`, `ecr.dkr`, `s3`, `logs`, `secretsmanager`.

## Task STOPPED with "ResourceInitializationError ... secrets"

The execution role couldn't read a secret.
- The role policy (`iam.tf`, `execution_secrets`) grants `secretsmanager:GetSecretValue`
  on exactly the created secret ARNs. If you added a new secret to the task def, make sure
  it's part of `aws_secretsmanager_secret.this` so the policy covers it.
- Check the secret exists: `aws secretsmanager describe-secret --secret-id decisionos-prod/SESSION_SECRET --region "$REGION"`.

## Target group unhealthy / ALB returns 503

The container started but the ALB health check on `/api/health` is failing.
- Tail logs: `aws logs tail "$LOGS" --follow --region "$REGION"`.
- The most common cause early on is **migrations failing on startup** (see below) - the
  process exits before serving. The 180s `health_check_grace_period_seconds` gives
  migrations time; longer migrations may need a bigger grace period or the separate
  migrate-task pattern (OPERATIONS.md → Scale out).
- Verify the app listens on `0.0.0.0:3000` (Dockerfile sets `HOSTNAME=0.0.0.0`, `PORT=3000`)
  and the target group port matches `container_port`.

## Migrations fail on startup

Logs show a Prisma migrate error, task exits non-zero.
- **Can't connect:** the `DATABASE_URL` secret host/password is wrong, or the RDS SG
  doesn't allow the ECS SG. Confirm `rds_from_ecs` ingress rule and that `DATABASE_URL`
  points at `terraform output rds_endpoint`.
- **Migration conflict / drift:** if the DB was created by `prisma db push` earlier, the
  `_prisma_migrations` table may be out of sync. For a fresh DB this won't happen; for an
  existing one, baseline with `prisma migrate resolve`.
- **Wrong provider:** the stack is Postgres. A `file:`/`libsql://` `DATABASE_URL` would make
  the app use the SQLite adapter and the Postgres migration would not apply.

## App 500s: "SESSION_SECRET is required in production"

`src/lib/env.ts` throws when `SESSION_SECRET` is unset/short in production. The task def
injects it from Secrets Manager - confirm the `SESSION_SECRET` secret has a value
(`aws secretsmanager get-secret-value --secret-id decisionos-prod/SESSION_SECRET`) and the
task def `secrets` block references it.

## Rate limiting behaves oddly across requests

If `REDIS_URL` is unset the limiter falls back to per-instance in-memory counters. Confirm
`REDIS_URL` is in the task `environment` and the Redis SG allows the ECS SG on 6379. With
one task this is moot, but with several it matters.

## `terraform apply` error: enabling scheduled jobs without HTTPS

`enable_scheduled_jobs = true` has a precondition requiring an HTTPS `app_url`. Set
`acm_certificate_arn` (and `domain_name`/`app_url`) first - EventBridge API destinations
only accept HTTPS endpoints. See `optional-scheduled-jobs.tf`.

## Cron endpoints return 401

EventBridge sends `Authorization: Bearer <CRON_SECRET>` via the connection. If the app
rejects it, the `CRON_SECRET` secret and the EventBridge connection value have diverged -
rotate both together, then redeploy and re-apply.

## Email isn't sending

Email is disabled unless `smtp_config` is set. When set, `SMTP_HOST/PORT/USER/FROM` go in
`environment` and `SMTP_PASS` in Secrets Manager. Check logs for `email send failed` and
verify the SMTP provider allows connections from the task's egress IP.

## General: where to look

| Symptom | First place to look |
|---|---|
| No tasks running | `describe-services` events + stopped-task `stoppedReason` |
| Task starts then dies | CloudWatch logs (`$LOGS`) |
| 502/503 from ALB | target group health + app logs |
| Can't pull image | ECR has image? public IP / egress? |
| Secret/permission errors | execution role policy + secret exists |
| DB/Redis connection | security group references + endpoint values |
