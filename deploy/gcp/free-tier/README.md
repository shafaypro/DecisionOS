# DecisionOS on GCP Free-Tier Compute

This deploys DecisionOS to a minimal Google Cloud setup:

- One `e2-micro` Compute Engine VM in `us-central1`, `us-east1`, or `us-west1`
- 30 GB `pd-standard` boot disk
- Docker Compose running:
  - `decisionos` Next.js app
  - `caddy` reverse proxy for HTTP or automatic HTTPS
- SQLite database stored at `/opt/decisionos/data/decisionos.db`
- Prisma migrations on container startup
- Host cron calls for review reminders and weekly digest endpoints
- Daily SQLite backups retained for 14 days on the persistent disk
- OS Login, Shielded VM, a dedicated service account, and firewall rules

## Service Choice

Recommended target for the current app: **Compute Engine e2-micro + Docker Compose + SQLite on persistent disk**.

Why not the other common GCP services for this version:

| Service | Fit for current DecisionOS | Reason |
|---|---|---|
| Compute Engine `e2-micro` | Best free-tier-aligned fit | Supports persistent local SQLite, Docker, cron, and Caddy on one small VM. |
| Cloud Run | Not recommended with SQLite | Containers are ephemeral; local SQLite persistence is not a good production contract. |
| App Engine | Not recommended with SQLite | Similar persistence mismatch and less direct control over local disk. |
| Cloud SQL | Good production database, not free-tier minimum | Managed Postgres/MySQL is the cleaner SaaS path, but it is paid/trial-based rather than always-free for this use case. |
| Firestore | Not recommended without a rewrite | DecisionOS uses Prisma relational models; Firestore would require a data-layer redesign. |

## Cost Notes

This is the closest GCP-only shape for a low-cost/free-tier DecisionOS deployment because the app already uses SQLite. Cloud SQL is a managed relational database, but it is not an always-free database for this use case.

Check current Google pricing before leaving it running:

- Compute Engine free-tier VM: https://cloud.google.com/free/docs/compute-getting-started
- Google Cloud free tier overview: https://cloud.google.com/free/docs/gcp-free-tier
- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- External IPv4 pricing: https://cloud.google.com/vpc/pricing

Important: public external IPv4 addresses and internet egress can still create charges. If you need a custom domain, `use_static_ip = true` gives you stable DNS, but external IPv4 usage can be billable.

## Prerequisites

Install these locally:

- Terraform 1.6+
- Google Cloud CLI
- A GCP project with billing enabled
- Permission to enable APIs and create Compute Engine resources

Authenticate:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

## Configure

```powershell
cd deploy/gcp/free-tier
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id = "your-gcp-project-id"
repo_url   = "https://github.com/shafaypro/DecisionOS.git"
repo_ref   = "main"

region = "us-central1"
zone   = "us-central1-a"
```

For a domain:

```hcl
domain_name   = "decisionos.example.com"
use_static_ip = true
```

After `terraform apply`, point your domain `A` record at the `external_ip` output. Caddy will request the TLS certificate once DNS resolves to the VM.

## Deploy

```powershell
terraform init
terraform apply
```

The first bootstrap builds the Docker image on the VM, so it can take several minutes on `e2-micro`.

Open the `app_url` output when the startup script is done.

## Troubleshooting

SSH through IAP:

```powershell
gcloud compute ssh decisionos --zone us-central1-a --tunnel-through-iap
```

Inspect bootstrap logs:

```bash
sudo tail -n 200 /var/log/decisionos-startup.log
```

Inspect app logs:

```bash
cd /opt/decisionos
sudo docker compose logs -f decisionos
sudo docker compose logs -f caddy
```

Restart after changing VM-local config:

```bash
cd /opt/decisionos
sudo docker compose up -d --build
```

## Security Defaults

- SSH is restricted to Google IAP TCP forwarding by default: `35.235.240.0/20`.
- Project SSH keys are blocked and OS Login is enabled.
- The VM uses a dedicated service account with logging and monitoring write scopes only.
- The app container stores SQLite on `/opt/decisionos/data`, mounted as `/data`.
- `SESSION_SECRET` and `CRON_SECRET` are generated on the VM if omitted and preserved in `/opt/decisionos/.env`.
- Caddy adds baseline security headers and enables HTTPS when `domain_name` is set.
- A 2 GB swap file is enabled so Docker builds can complete on the small `e2-micro` shape.
- Debian unattended security upgrades are installed.

## Backups

SQLite is simple, but you must back it up. A minimal manual backup:
This deployment also writes daily local backups to `/opt/decisionos/data/backups` and keeps 14 days.

```bash
sudo sqlite3 /opt/decisionos/data/decisionos.db ".backup '/opt/decisionos/data/decisionos-$(date +%F).db'"
```

For anything beyond a personal MVP, move the database to Postgres and budget for a managed database or an external free Postgres provider.
