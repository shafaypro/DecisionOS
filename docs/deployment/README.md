# Deployment Guide

Choose a deployment target based on your team size, budget, and operational preference. This page compares the targets; the detailed walkthroughs below cover the live setup end to end.

> **CI/CD.** DecisionOS builds and tests on **GitHub Actions** ([`ci.yml`](https://github.com/shafaypro/DecisionOS/blob/main/.github/workflows/ci.yml) gates every PR; [`release-images.yml`](https://github.com/shafaypro/DecisionOS/blob/main/.github/workflows/release-images.yml) publishes images to **GHCR** when a release is published). Deploy targets then pull those images. **Docker Compose** and **AWS EC2** are the best-trodden self-host paths; **GCP Free-Tier**, **AWS ECS Fargate**, and **Kubernetes** are community-supported references - complete as written, but verify before relying on them in production.

## Guides in this folder

| Guide | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | The whole running system in one diagram, then a guide to each part |
| [AWS_EC2_DEPLOYMENT_RUNBOOK.md](AWS_EC2_DEPLOYMENT_RUNBOOK.md) | Self-host on a single EC2, step by step, plus operations |
| [GCP.md](GCP.md) | The Google Cloud free-tier walkthrough |

---

## Quick comparison

| | Docker Compose | AWS EC2 | GCP Free-Tier | AWS ECS Fargate | Kubernetes |
|---|---|---|---|---|---|
| **Path** | `deploy/docker-compose/` | `deploy/aws-ec2/` | `deploy/gcp/free-tier/` | `deploy/aws-ecs/` | `deploy/kubernetes/` |
| **Support** | Supported | **Primary** | Community | Community | Community |
| **Cost** | Your server | ~$8-15/mo | Free tier eligible | ~$50-100/mo | Cluster-dependent |
| **Database** | Postgres (bundled) | Postgres (bundled) | SQLite (local) | RDS Postgres (managed) | External Postgres |
| **HA** | No | No | No | Yes (multi-AZ) | Yes (replicas + PDB) |
| **Auto-scaling** | No | No | No | Yes (ECS service) | Yes (HPA) |
| **TLS** | Caddy (auto) | Caddy (auto) | Caddy (auto) | ACM (optional) | Ingress controller |
| **Migrations** | One-shot container | One-shot container | Startup script | ECS one-shot task | Init container / Job |
| **Provisioning** | Manual | Terraform | Terraform | Terraform | kubectl / Helm |
| **Best for** | Self-hosted, homelab | Small teams on AWS | MVP, demos | Production at scale | Teams with K8s |

---

## Prerequisites (all targets)

1. **Docker image** - built from the repo's multi-stage `Dockerfile`:
   ```bash
   docker build -t decisionos:latest --target runner .
   docker build -t decisionos-migrator:latest --target migrator .
   ```
2. **Secrets** - every target needs at minimum:
   - `SESSION_SECRET` - `openssl rand -hex 32`
   - `DATABASE_URL` - Postgres connection string (or `file:./dev.db` for SQLite targets)
3. **Domain** (optional) - for automatic TLS via Caddy or ACM

---

## 1. Docker Compose (self-hosted)

**`deploy/docker-compose/`** - full production stack on a single server.

Services: Postgres 16 + Redis 7 + migrator (one-shot) + app + Caddy (reverse proxy + auto-TLS).

```bash
cd deploy/docker-compose
cp .env.example .env         # edit secrets + domain
docker compose up -d
curl https://your-domain.com/api/seed   # initial data
```

See [`deploy/docker-compose/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/docker-compose/README.md) for full setup.

**When to choose:** You have your own server (VPS, homelab, on-prem) and want a simple,
self-contained deployment with no cloud vendor dependency.

---

## 2. AWS EC2 (single instance)

**`deploy/aws-ec2/`** - Terraform-provisioned EC2 instance running Docker Compose.

Architecture: VPC + public subnet + t3.micro + EBS + Elastic IP + Docker Compose (Postgres + Redis + app + Caddy).

```bash
cd deploy/aws-ec2
cp terraform.tfvars.example terraform.tfvars   # edit
terraform init && terraform apply
```

See [`deploy/aws-ec2/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/aws-ec2/README.md) for full setup.

**When to choose:** Small team on AWS, want managed infrastructure (Terraform) but don't
need the complexity of ECS/RDS. Budget-friendly at ~$8-15/mo.

---

## 3. GCP Free-Tier

**`deploy/gcp/free-tier/`** - Terraform-provisioned e2-micro on GCP.

Architecture: Compute Engine VM + persistent disk + SQLite + Caddy.

See [`deploy/gcp/free-tier/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/gcp/free-tier/README.md) for the infra, and [GCP.md](GCP.md) for the full step-by-step walkthrough.

**When to choose:** Zero-cost MVP or demo. Limited to SQLite (no Redis, no horizontal scaling).

---

## 4. AWS ECS Fargate

**`deploy/aws-ecs/`** - production-grade AWS deployment.

Architecture: ALB + ECS Fargate + RDS Postgres + ElastiCache Redis + Secrets Manager + CloudWatch.

See [`deploy/aws-ecs/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/aws-ecs/README.md).

**When to choose:** Production workload on AWS. Managed scaling, managed database,
managed caching. Supports multi-AZ for high availability.

---

## 5. Kubernetes

**`deploy/kubernetes/`** - portable manifests for any conformant cluster.

Architecture: Deployment + Service + Ingress + ConfigMap + Secret + HPA + PDB + migration Job.

```bash
cd deploy/kubernetes
cp values.example.yaml values.yaml   # edit
# Option A: plain manifests
kubectl apply -k base/
# Option B: with Kustomize overlays
kubectl apply -k overlays/production/
```

See [`deploy/kubernetes/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/kubernetes/README.md).

**When to choose:** You already run Kubernetes (EKS, GKE, AKS, k3s, etc.) and want
DecisionOS to fit into your existing cluster with standard K8s patterns.

---

## Shared patterns across all targets

### Migration strategy

Migrations run once per deploy, never per replica:

- **Docker Compose / EC2 / GCP:** `migrate` service with `restart: "no"` runs before the app starts
- **ECS:** One-shot ECS task (or CI step) runs before the service update
- **Kubernetes:** `Job` or init container runs `prisma migrate deploy`

### Health checks

All targets should probe `GET /api/health` (returns 200 when the app is ready).

### Cron jobs

Three scheduled endpoints need to be called:

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/review-reminders` | Daily 8:00 AM | Slack DMs + email for upcoming reviews |
| `/api/cron/weekly-digest` | Monday 9:00 AM | Weekly email digest |
| `/api/cron/audit-retention` | Daily 3:37 AM | Purge audit-log rows past the retention window |

Each accepts **GET or POST** and requires the `Authorization: Bearer $CRON_SECRET` header.

- **Vercel:** Configured in `vercel.json`
- **ECS:** Optional scheduled Fargate tasks (see `optional-scheduled-jobs.tf`)
- **Docker Compose / EC2 / GCP:** Host crontab entries
- **Kubernetes:** `CronJob` resources

### Secrets management

| Target | Mechanism |
|--------|-----------|
| Docker Compose | `.env` file (chmod 600) |
| EC2 / GCP | `.env` file on instance |
| ECS | AWS Secrets Manager |
| Kubernetes | K8s `Secret` resources (+ optional external-secrets-operator) |

### Backup strategy

| Target | Database | Backup method |
|--------|----------|---------------|
| Docker Compose | Postgres | `pg_dump` via cron (see Compose README) |
| EC2 | Postgres | `pg_dump` via cron + S3 upload |
| GCP | SQLite | `sqlite3 .backup` via cron |
| ECS | RDS | Automated RDS snapshots (7-day retention default) |
| Kubernetes | External Postgres | Provider-managed snapshots |
