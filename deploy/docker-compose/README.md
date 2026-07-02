# Docker Compose - Self-Hosted Production

Run DecisionOS on any server with Docker installed. This stack includes Postgres,
Redis, automatic database migrations, and Caddy for reverse proxy with auto-TLS.

## Architecture

```
Internet → Caddy (:80/:443, auto-TLS) → App (:3000) → Postgres (:5432)
                                                     → Redis (:6379)
```

## Prerequisites

- Docker Engine 24+ with Compose v2
- A server with 1+ GB RAM (2 GB recommended)
- A domain pointing to your server's IP (for auto-TLS; optional for IP-only)

## Setup

```bash
cd deploy/docker-compose

# 1. Configure
cp .env.example .env
# Edit .env - set SESSION_SECRET, POSTGRES_PASSWORD, CRON_SECRET, APP_URL, DOMAIN

# 2. Start
docker compose up -d

# 3. Seed demo data (optional, first run only)
curl -X POST https://your-domain.com/api/seed
```

## IP-only mode (no domain)

If you don't have a domain, edit `.env`:
```
DOMAIN=:80
APP_URL=http://YOUR_SERVER_IP
```

## Upgrades

```bash
git pull origin main
docker compose build
docker compose up -d
# The migrator service runs automatically before the app starts.
```

## Backups

Add a cron job on the host to dump Postgres daily:

```bash
# /etc/cron.d/decisionos-backup
0 3 * * * root docker compose -f /path/to/docker-compose.yml exec -T postgres \
  pg_dump -U decisionos decisionos | gzip > /backups/decisionos-$(date +\%Y\%m\%d).sql.gz
```

Retain 7 days:
```bash
find /backups -name "decisionos-*.sql.gz" -mtime +7 -delete
```

## Cron jobs

DecisionOS has three scheduled endpoints. Add to the host's crontab:

```bash
# Review reminders - daily at 8 AM
0 8 * * * curl -sS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/review-reminders

# Weekly digest - Monday at 9 AM
0 9 * * 1 curl -sS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/weekly-digest

# Audit-log retention purge - daily at 3:37 AM
37 3 * * * curl -sS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/audit-retention
```

The `/api/cron/*` endpoints accept either GET or POST.

## Monitoring

Check service health:
```bash
docker compose ps
curl -s https://your-domain.com/api/health | jq
```

View logs:
```bash
docker compose logs -f app       # Application logs
docker compose logs -f caddy     # Reverse proxy logs
docker compose logs -f postgres  # Database logs
```

## Resource requirements

| Users | RAM | CPU | Disk |
|-------|-----|-----|------|
| < 50 | 1 GB | 1 vCPU | 10 GB |
| 50-200 | 2 GB | 2 vCPU | 20 GB |
| 200-500 | 4 GB | 2 vCPU | 40 GB |
