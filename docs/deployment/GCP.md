# DecisionOS Deployment Guide

This guide explains how to deploy DecisionOS to Google Cloud using the included Infrastructure as Code in `deploy/gcp/free-tier`.

> **Deploying to AWS instead?** See the [AWS EC2 runbook](AWS_EC2_DEPLOYMENT_RUNBOOK.md)
> (single free-tier `t3.micro`, Postgres + Redis + Caddy via Docker Compose), including the
> off-box GHCR image-build flow so the instance never builds. Other targets live under
> [`deploy/`](https://github.com/shafaypro/DecisionOS/tree/main/deploy) (`aws-ecs`, `kubernetes`, `docker-compose`).

The current recommended target is:

```text
Google Compute Engine e2-micro
Docker Compose
Caddy reverse proxy
SQLite on persistent disk
Terraform-managed GCP infrastructure
```

## Why This Service

DecisionOS currently runs as a Next.js app with Prisma and SQLite. For the smallest GCP deployment that can stay close to the free tier, Compute Engine is the best fit because it gives the app a persistent disk for the SQLite database.

| GCP service | Recommendation | Reason |
|---|---|---|
| Compute Engine `e2-micro` | Use for the minimum setup | Supports persistent disk, Docker, cron, Caddy, and SQLite without changing the app. |
| Cloud Run | Avoid for current app | Cloud Run containers are ephemeral. SQLite persistence is not a good production contract there. |
| App Engine | Avoid for current app | Same persistence mismatch for local SQLite. |
| Cloud SQL | Good later, not minimum free-tier | Managed Postgres is a better SaaS production database, but it is paid/trial-based rather than the minimum free-tier path. |
| Firestore | Avoid unless rewriting data layer | The app uses Prisma relational models. Firestore would require a data model rewrite. |

Google documents the Compute Engine free tier as one non-preemptible `e2-micro` VM per month in selected US regions, plus standard persistent disk and limited outbound transfer. Always check the current Google Cloud Free Tier page before deploying because limits and billing behavior can change.

## What The IaC Creates

The Terraform files in `deploy/gcp/free-tier` create:

- Compute Engine API, IAM API, and IAP API enablement.
- A dedicated VPC network and subnet.
- Firewall rule for public web traffic on ports `80` and `443`.
- Firewall rule for SSH only from Google IAP TCP forwarding by default: `35.235.240.0/20`.
- A dedicated VM service account.
- Optional static external IP address.
- One Debian 12 `e2-micro` VM with a 30 GB standard persistent disk.
- Shielded VM settings.
- Startup script that installs Docker, clones the repo, builds the app, writes environment config, starts Docker Compose, enables Caddy, configures cron, and creates local SQLite backups.

The running VM uses:

- `/opt/decisionos/app` for the cloned repo.
- `/opt/decisionos/.env` for runtime secrets.
- `/opt/decisionos/data/decisionos.db` for SQLite.
- `/opt/decisionos/data/backups` for daily SQLite backups.
- `/var/log/decisionos-startup.log` for bootstrap logs.

## Prerequisites

Install locally:

- Google Cloud CLI: `gcloud`
- Terraform `>= 1.6`
- Git

You also need:

- A GCP project with billing enabled.
- Permission to create Compute Engine, VPC, IAM service account, firewall, and IAP resources.
- A reachable Git repository URL. The included startup script assumes `repo_url` is cloneable by the VM over HTTPS.

For a personal project, using an Owner account is the simplest path. For least privilege, the deploying account needs permissions to enable services, manage Compute Engine resources, create service accounts, and manage network/firewall resources.

## Step 1: Authenticate To GCP

Run this from PowerShell:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Confirm the active project:

```powershell
gcloud config get-value project
```

## Step 2: Configure Terraform Variables

From the repo root:

```powershell
cd GenAILearningProjects/DecisionOS/deploy/gcp/free-tier
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id = "your-gcp-project-id"

repo_url = "https://github.com/shafaypro/DecisionOS.git"
repo_ref = "main"

region = "us-central1"
zone   = "us-central1-a"

domain_name   = ""
use_static_ip = false
```

Use one of these regions for the free-tier-aligned VM:

```text
us-central1
us-east1
us-west1
```

Keep the disk as standard persistent disk and keep the VM shape as `e2-micro` if your goal is the lowest-cost setup.

## Step 3: Decide Domain Or IP-Only

### Option A: IP-only HTTP

For the simplest setup, leave:

```hcl
domain_name   = ""
use_static_ip = false
```

Terraform outputs an `http://EXTERNAL_IP` URL. This is fine for a quick MVP test, but not ideal for production because the IP can change if the VM is recreated.

### Option B: Domain with HTTPS

For a real demo or production-like setup:

```hcl
domain_name   = "decisionos.example.com"
use_static_ip = true
```

After `terraform apply`, Terraform prints `external_ip`. Create an `A` record at your DNS provider:

```text
decisionos.example.com -> external_ip
```

Caddy automatically requests and renews the TLS certificate once DNS resolves to the VM.

Note: external IPv4 addresses can create charges. Check Google VPC pricing before using a static IP long term.

## Step 4: Set Optional Secrets

You can leave these blank for the minimum deploy:

```hcl
session_secret = ""
cron_secret    = ""
```

If blank, the VM generates and preserves them in:

```text
/opt/decisionos/.env
```

For a more controlled setup, generate secrets locally:

```powershell
openssl rand -base64 48
```

Then set:

```hcl
session_secret = "paste-generated-value"
cron_secret    = "paste-generated-value"
```

Optional integrations:

```hcl
smtp_host = ""
smtp_port = "587"
smtp_user = ""
smtp_pass = ""
smtp_from = ""

anthropic_api_key = ""
```

## Step 5: Deploy Infrastructure

From `deploy/gcp/free-tier`:

```powershell
terraform init
terraform validate
terraform plan
terraform apply
```

Approve the apply when Terraform shows the planned resources.

The first boot can take several minutes because the VM installs packages and builds the Docker image.

## Step 6: Verify The App

Terraform prints:

```text
app_url
external_ip
ssh_command
startup_log_command
```

Open `app_url` in your browser.

If the app is not ready yet, SSH into the VM:

```powershell
gcloud compute ssh decisionos --zone us-central1-a --tunnel-through-iap
```

Check startup logs:

```bash
sudo tail -n 200 /var/log/decisionos-startup.log
```

Check containers:

```bash
cd /opt/decisionos
sudo docker compose ps
sudo docker compose logs -f decisionos
sudo docker compose logs -f caddy
```

Check the health endpoint:

```bash
curl -i http://127.0.0.1/api/health
```

## Step 7: Create Your First User

Open:

```text
https://your-domain.example.com/signup
```

or, for IP-only:

```text
http://EXTERNAL_IP/signup
```

Create the first workspace admin user through the signup page.

The demo seed endpoint is disabled in production, so do not rely on `/api/seed` for a deployed environment.

## Updating The Deployment

Push changes to the branch configured by `repo_ref`, then restart the VM or rerun the startup deployment logic.

Simple path:

```powershell
gcloud compute instances reset decisionos --zone us-central1-a
```

The startup script fetches the configured `repo_ref`, rebuilds the container, runs Prisma migrations, and restarts the app.

Manual path over SSH:

```bash
cd /opt/decisionos/app
sudo git fetch origin dev2 --depth=1
sudo git checkout -B deploy FETCH_HEAD
cd /opt/decisionos
sudo docker compose up -d --build
```

## Database And Backups

The production SQLite database is:

```text
/opt/decisionos/data/decisionos.db
```

The deployment creates daily local backups and keeps 14 days:

```text
/opt/decisionos/data/backups
```

Manual backup:

```bash
sudo sqlite3 /opt/decisionos/data/decisionos.db ".backup '/opt/decisionos/data/backups/decisionos-manual.db'"
```

Copy backup to your local machine:

```powershell
gcloud compute scp decisionos:/opt/decisionos/data/backups/decisionos-manual.db . --zone us-central1-a --tunnel-through-iap
```

For serious production use, move from SQLite to Postgres and use a managed database or a dedicated Postgres provider. That will improve durability and concurrency, but it will no longer be the minimum free-tier setup.

## Database Migrations

Migrations are applied by a dedicated one-shot **migrator** image (the `migrator`
target in the `Dockerfile`), never by the serving container. This keeps the
serving image slim (production dependencies only) and - critically - means
scaling to multiple replicas never triggers concurrent `migrate deploy` runs.

- **Single instance (GCP free-tier compose):** the `migrate` service in
  `deploy/gcp/free-tier/docker-compose.yml` runs once and the app waits for it to
  complete (`depends_on: condition: service_completed_successfully`). No action
  needed - `docker compose up` migrates then serves.
- **Multiple replicas (e.g. AWS ECS):** run the migrator image **once per deploy**
  as a pre-deploy step or a standalone one-shot task *before* rolling the service,
  and do **not** let serving tasks migrate:

  ```bash
  # build + run the one-shot migrator against your production DATABASE_URL
  docker build --target migrator -t decisionos-migrator .
  docker run --rm -e DATABASE_URL="$DATABASE_URL" decisionos-migrator
  ```

## Logs And Troubleshooting

Startup logs:

```bash
sudo tail -n 200 /var/log/decisionos-startup.log
```

App logs:

```bash
cd /opt/decisionos
sudo docker compose logs -f decisionos
```

Caddy logs:

```bash
cd /opt/decisionos
sudo docker compose logs -f caddy
```

Restart app:

```bash
cd /opt/decisionos
sudo docker compose restart decisionos
```

Rebuild app:

```bash
cd /opt/decisionos
sudo docker compose up -d --build
```

Check disk:

```bash
df -h
du -h /opt/decisionos/data
```

Check memory and swap:

```bash
free -h
swapon --show
```

## Common Problems

### Terraform cannot authenticate

Run:

```powershell
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Then retry:

```powershell
terraform plan
```

### The app URL does not load

Check:

```bash
sudo tail -n 200 /var/log/decisionos-startup.log
cd /opt/decisionos
sudo docker compose ps
sudo docker compose logs --tail=100 decisionos
```

The first build on `e2-micro` can take several minutes.

### HTTPS certificate is not issued

Confirm your DNS `A` record points to the `external_ip` output.

Then check Caddy:

```bash
cd /opt/decisionos
sudo docker compose logs --tail=100 caddy
```

### SSH does not work

The default firewall allows SSH from Google IAP only. Use:

```powershell
gcloud compute ssh decisionos --zone us-central1-a --tunnel-through-iap
```

If your user lacks IAP permissions, grant `roles/iap.tunnelResourceAccessor` and the needed Compute Engine SSH permissions.

### Private GitHub repository cannot clone

The current startup script assumes the VM can clone `repo_url` without interactive authentication.

Options:

1. Use a public GitHub repository for the MVP.
2. Mirror the deploy branch to a public/private deploy-only repository with appropriate access.
3. Extend the Terraform with Secret Manager and a deploy token or SSH deploy key.

Do not hard-code a GitHub token directly into Terraform files committed to the repo.

## Security Checklist

Before using this outside local testing:

- Use a domain with HTTPS.
- Use strong `session_secret` and `cron_secret`.
- Keep SSH restricted to IAP or your own CIDR.
- Do not commit `.env`, `.tfvars`, database files, or backup files.
- Confirm `/api/seed` remains disabled in production.
- Configure SMTP only with app-specific credentials.
- Keep backups and know how to restore them.
- Review Google Cloud billing reports after deployment.

## Destroy The Deployment

If you no longer need the environment:

```powershell
cd deploy/gcp/free-tier
terraform destroy
```

This deletes the VM and its boot disk, including the SQLite database and local backups. Download a backup first if you need the data.

## Reference Links

- GCP free tier: https://cloud.google.com/free/docs/compute-getting-started
- GCP free cloud features: https://cloud.google.com/free/docs/free-cloud-features
- IAP TCP forwarding: https://cloud.google.com/iap/docs/using-tcp-forwarding
- VPC firewall rules: https://cloud.google.com/firewall/docs/firewalls
- VPC pricing: https://cloud.google.com/vpc/pricing
