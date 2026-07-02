# Architecture - DecisionOS on AWS ECS

This document explains *what* the Terraform stack builds and *why* it's shaped the
way it is. For commands, see [OPERATIONS.md](OPERATIONS.md); for when things break,
see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Components

| Layer | Resource | File | Notes |
|---|---|---|---|
| Edge | Application Load Balancer | `alb.tf` | Public, HTTP :80 (→ :443 when HTTPS enabled). Health-checks `/api/health`. |
| Compute | ECS Fargate service + task | `ecs.tf` | 1 task (lean). Next.js server on :3000, non-root. |
| Registry | ECR repository | `ecr.tf` | Scan-on-push, keeps last 10 images. |
| Database | RDS PostgreSQL | `database.tf` | `db.t4g.micro`, encrypted, private, 7-day backups. |
| Cache | ElastiCache Redis | `cache.tf` | Single node. Backs the distributed rate limiter. |
| Secrets | Secrets Manager | `secrets.tf` | `SESSION_SECRET`, `DATABASE_URL`, `CRON_SECRET` (+ `SMTP_PASS`). |
| Identity | IAM roles | `iam.tf` | Execution role (pull + logs + read *these* secrets), task role (empty). |
| Network | VPC, subnets, IGW, SGs | `network.tf`, `security.tf` | 2 public + 2 private subnets, no NAT. |
| Logs | CloudWatch Logs | `ecs.tf` | `/ecs/decisionos-prod`, 30-day retention. |
| Optional | HTTPS, Route 53 | `optional-https.tf` | Disabled until `acm_certificate_arn` is set. |
| Optional | EventBridge cron | `optional-scheduled-jobs.tf` | Disabled until `enable_scheduled_jobs = true`. |

## Network design

```
VPC 10.20.0.0/16
├── Public subnets  (10.20.0.0/24, 10.20.1.0/24)   → route to Internet Gateway
│     • ALB
│     • Fargate tasks (public IP, so they pull from ECR over the IGW)
└── Private subnets (10.20.10.0/24, 10.20.11.0/24) → no internet route
      • RDS Postgres
      • ElastiCache Redis
```

**Why Fargate tasks sit in public subnets:** a Fargate task must reach ECR, Secrets
Manager and CloudWatch over the internet to start. The two ways to give it that are
(a) a NAT gateway from private subnets (~$32/mo + data) or (b) a public IP in a public
subnet. The lean starter chooses (b) to avoid the NAT cost. The tasks are still not
*reachable* from the internet - their security group only accepts traffic from the
ALB. For a hardened production setup, move tasks to private subnets + NAT (or VPC
endpoints for ECR/Secrets Manager/Logs) - see OPERATIONS.md.

**Why two AZs:** RDS and ElastiCache subnet groups require subnets in ≥ 2 AZs even for
single-node deployments. The data stores run in one AZ (single-node), but the subnet
groups span two so you can later enable Multi-AZ without re-architecting.

## Security model

- **Security groups chain by reference, not CIDR.** ALB allows `:80/:443` from the
  world; ECS allows `:3000` *only from the ALB's SG*; RDS allows `:5432` and Redis
  `:6379` *only from the ECS SG*. There is no `0.0.0.0/0` ingress to the app or data
  tiers.
- **Data stores are not publicly accessible.** `publicly_accessible = false` on RDS;
  both live in private subnets with no internet route.
- **Secrets never sit in plaintext env.** `SESSION_SECRET`, `DATABASE_URL`,
  `CRON_SECRET` (and `SMTP_PASS`) are stored in Secrets Manager and injected by the
  ECS agent via the task definition `secrets` block. The execution role can read
  *only* these specific secret ARNs.
- **Encryption at rest** is on for RDS storage; ECR images are encrypted by default.
- **State contains secrets.** Terraform state holds the generated `SESSION_SECRET`
  and DB password, so `.gitignore` excludes it. Use a remote backend (S3 + DynamoDB
  lock) with encryption before sharing this across a team - see OPERATIONS.md.

## Request & data flow

1. Client → `http(s)://<alb>` → ALB listener → target group → Fargate task `:3000`.
2. ALB health check polls `GET /api/health` (cheap, no DB) every 30s; unhealthy tasks
   are replaced.
3. The app reads `DATABASE_URL` (Postgres) and `REDIS_URL` at runtime. Prisma uses the
   `pg` adapter because the URL starts with `postgresql://`.
4. On task start, the container `CMD` runs `prisma migrate deploy` before `next start`,
   so schema migrations apply automatically on each deploy.

## Configuration injection

| Value | Mechanism | Why |
|---|---|---|
| `SESSION_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `SMTP_PASS` | task def `secrets` ← Secrets Manager | sensitive |
| `REDIS_URL`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `LOG_LEVEL`, `DATABASE_POOL_MAX`, `SMTP_HOST/PORT/USER/FROM` | task def `environment` | non-sensitive |

`NEXT_PUBLIC_APP_URL` is special: Next.js inlines `NEXT_PUBLIC_*` into the **client
bundle at build time**. Server-side reads (magic-link emails, server-rendered share
CTAs) use it at runtime and are correct. If you depend on it in client components, set
`app_url`/`domain_name` and rebuild so the value is baked in.

## Lean vs. production HA

| Concern | Lean starter (this stack) | Production HA (follow-up) |
|---|---|---|
| Fargate tasks | 1 | ≥ 2 + service autoscaling |
| DB migrations | run on task start (CMD) | separate one-off migrate task |
| RDS | single-AZ, `skip_final_snapshot` | Multi-AZ, deletion protection, final snapshot |
| Redis | single node | replication group + automatic failover |
| Egress | public subnet + public IP | private subnets + NAT / VPC endpoints |
| TLS | HTTP (ALB DNS) | ACM cert + HTTPS + custom domain |
| Edge | ALB only | + WAF |

Each row is a deliberate cost/complexity trade for a first deploy, and each has a
documented upgrade path in OPERATIONS.md.
