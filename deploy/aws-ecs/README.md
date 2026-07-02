# Deploying DecisionOS to AWS ECS (Fargate)

A lean, cost-conscious starter stack: one Fargate service behind a public ALB,
managed Postgres (RDS), managed Redis (ElastiCache), image in ECR, runtime
secrets in Secrets Manager. Everything is Terraform; no resources are created by
clicking in the console.

> **More docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (what's built and why),
> [docs/OPERATIONS.md](docs/OPERATIONS.md) (day-2 runbook), and
> [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) (when things break).

```
                 Internet
                    │  HTTP :80
              ┌─────▼─────┐
              │    ALB     │  (public subnets, 2 AZs)
              └─────┬─────┘
                    │  :3000  /api/health
            ┌───────▼────────┐
            │ ECS Fargate     │  desired_count = 1 (public subnet, public IP → ECR)
            │ DecisionOS task │  secrets ← Secrets Manager, logs → CloudWatch
            └───┬────────┬────┘
        :5432   │        │   :6379
        ┌───────▼──┐  ┌──▼─────────┐
        │ RDS      │  │ ElastiCache │  (private subnets, no internet egress)
        │ Postgres │  │ Redis       │
        └──────────┘  └─────────────┘
```

## Prerequisites

- An AWS account and credentials configured (`aws configure`, an SSO profile, or
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars).
- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6
- Docker (running) and the AWS CLI v2
- The IAM principal needs permission to create VPC/ECS/RDS/ElastiCache/ALB/ECR/
  IAM/Secrets Manager/CloudWatch resources.

## First deploy

All commands run from `deploy/aws-ecs/`.

```bash
cp terraform.tfvars.example terraform.tfvars   # edit if you want non-defaults
terraform init
terraform apply
```

`apply` creates the whole stack. **On the first apply the ECS task has no image to
pull yet**, so the service is created but no task will be `RUNNING` - that's
expected. Now build and push the image, which also rolls the service:

```powershell
# Windows (PowerShell)
./scripts/build-and-push.ps1
```
```bash
# macOS / Linux / CI
./scripts/build-and-push.sh
```

Wait for it to go healthy, then open the URL:

```bash
aws ecs wait services-stable \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --services "$(terraform output -raw ecs_service_name)" \
  --region  "$(terraform output -raw ecr_repository_url | cut -d. -f4)"

terraform output app_url      # http://<alb-dns>
```

Then seed demo data (one time) and sign in:

```bash
curl "$(terraform output -raw app_url)/api/seed"
# sign in at the app URL with admin@acme.demo / password123
```

## Shipping a new version

Re-run the build script - it builds, pushes `:latest` + `:sha-<commit>`, and forces
a fresh ECS deployment (rolling, zero-downtime once `desired_count ≥ 2`):

```bash
./scripts/build-and-push.sh
```

## How config reaches the container

| Value | Source | Notes |
|---|---|---|
| `SESSION_SECRET` | Secrets Manager (generated) | **Stable** - never rotate casually; rotating invalidates sessions and stored Slack/SSO secrets. |
| `DATABASE_URL` | Secrets Manager (from RDS) | `postgresql://…` → app uses the pg adapter. |
| `CRON_SECRET` | Secrets Manager (generated) | Required by `/api/cron/*`. |
| `REDIS_URL` | env (from ElastiCache) | Enables the distributed rate limiter. |
| `NEXT_PUBLIC_APP_URL` | env (`app_url` or ALB DNS) | See the caveat below. |
| `SMTP_*` | env + Secrets Manager (`SMTP_PASS`) | Only if `smtp_config` is set. |

Migrations run automatically on container start (`prisma migrate deploy`, baked
into the Dockerfile `CMD`).

## Important caveats

- **`NEXT_PUBLIC_APP_URL` is inlined into the client bundle at build time.** Server-side
  uses (magic-link emails, share CTAs rendered on the server) read it at runtime and
  are fine. If you rely on it in client components, set `app_url` *before* building so
  the value is baked in - easiest once you have a custom domain (below).
- **Keep `desired_count = 1` for now.** Migrations run on every task start, so two tasks
  starting together would race. To scale out: run migrations as a one-off task
  (`aws ecs run-task` with command `npm run db:migrate:deploy`), drop migration from the
  app `CMD`, then raise `desired_count`. Tracked as a follow-up.
- **App cron routes are not scheduled by default.** `vercel.json` crons only run on Vercel.
  The EventBridge schedules that hit `/api/cron/*` are written in
  [optional-scheduled-jobs.tf](optional-scheduled-jobs.tf) but **disabled** - enable with
  `enable_scheduled_jobs = true` once HTTPS is configured (EventBridge API destinations
  require an HTTPS endpoint).

## Adding HTTPS + a custom domain (optional, when you own a domain)

The resources are already written in [optional-https.tf](optional-https.tf) and
[optional-scheduled-jobs.tf](optional-scheduled-jobs.tf), **disabled by default** so they
create nothing until you opt in. You don't have a domain yet, so leave them off - the
stack runs on HTTP via the ALB DNS.

When ready, the full step-by-step is in
[docs/OPERATIONS.md → Adding HTTPS + a custom domain](docs/OPERATIONS.md#adding-https--a-custom-domain).
In short: get an ACM cert, set `acm_certificate_arn` / `domain_name` / `route53_zone_id`
in `terraform.tfvars`, `terraform apply`, then rebuild the image (so `NEXT_PUBLIC_APP_URL`
is inlined). After that, set `enable_scheduled_jobs = true` to turn on the cron schedules.

## Rough monthly cost (us-east-1, always-on)

ALB ~$16 + Fargate 0.5vCPU/1GB ~$18 + RDS `db.t4g.micro` ~$13 + ElastiCache
`cache.t4g.micro` ~$12 + storage/logs/secrets ~$5 ≈ **$60-70/mo**. No NAT gateway
(that's another ~$32/mo) because tasks sit in public subnets. Stopping is just
`terraform destroy`.

## Security scanning (recommended before apply)

```bash
trivy config .
checkov -d .
```
Both are static IaC scanners; wire them into CI alongside `terraform validate`.

## Tear down

```bash
terraform destroy
```
RDS `skip_final_snapshot = true` and ECR `force_delete = true` are set for easy
teardown - flip those (and `deletion_protection`) before holding real data.
```
