# AWS EC2 Deployment Runbook (minimum-cost / free-tier)

This is the step-by-step record of deploying DecisionOS to AWS on a single
free-tier-eligible EC2 instance. It covers the bootstrap bugs that had to be
fixed to make it work and the private-repo workaround used.

It complements [`deploy/aws-ec2/README.md`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/aws-ec2/README.md). That
file describes the *intended* flow; this file records what actually happened and
the deltas required.

---

## 1. Target architecture (what we deployed)

```
Internet → Elastic IP (<server-ip>) → EC2 t3.micro (eu-west-1)
                                          ├─ Caddy   (:80, reverse proxy)
                                          ├─ app     (:3000, Next.js)
                                          ├─ migrate (one-shot, prisma migrate deploy)
                                          ├─ postgres (:5432, internal)
                                          └─ redis    (:6379, internal)
```

- **Region:** `eu-west-1` (matches the operator's AWS CLI config)
- **Instance:** `t3.micro` (free-tier eligible, 750 hrs/mo for the first 12 months)
- **Storage:** 20 GB gp3, encrypted (free tier covers 30 GB)
- **Networking:** dedicated VPC + public subnet + IGW + security group (ports 80/443/22)
- **No RDS, ALB, or NAT Gateway.** Postgres and Redis run as containers on the box.

### Cost

| Item | Free-tier (first 12 mo) | After free tier |
|---|---|---|
| t3.micro (750 hrs) | $0 | ~$7.5/mo |
| 20 GB gp3 | $0 (under 30 GB) | ~$1.6/mo |
| Elastic IP (in use) | **~$3.6/mo** (AWS bills all public IPv4) | ~$3.6/mo |
| **Total** | **~$3-4/mo** | **~$10-13/mo** |

The Elastic IP charge is unavoidable. AWS has billed every public IPv4 address
since Feb 2024, even one that is in use.

---

## 2. Prerequisites used

- Terraform 1.6.3, AWS CLI, OpenSSL, OpenSSH (all local on the operator machine)
- AWS credentials (account root) with region `eu-west-1`
- The DecisionOS repo checked out locally on `main`

---

## 3. Steps performed

### 3.1 SSH key pair

```bash
ssh-keygen -t ed25519 -N "" -C decisionos-prod -f ~/.ssh/decisionos-prod
aws ec2 import-key-pair --region eu-west-1 --key-name decisionos-prod \
  --public-key-material fileb://C:/Users/<you>/.ssh/decisionos-prod.pub
```

> The Windows AWS CLI needs a **Windows-style path** for `fileb://`
> (`fileb://C:/...`), not a Git-Bash `/c/...` path.

Private key saved to `~/.ssh/decisionos-prod` (ed25519). The SSH user is `admin`
(Debian 12 AMI).

### 3.2 Secrets + `terraform.tfvars`

```bash
openssl rand -hex 32   # session_secret
openssl rand -hex 16   # postgres_password
openssl rand -hex 16   # cron_secret
```

`deploy/aws-ec2/terraform.tfvars` (git-ignored via root `.gitignore` `*.tfvars`):

```hcl
session_secret    = "<hex32>"
postgres_password = "<hex16>"
cron_secret       = "<hex16>"
aws_region        = "eu-west-1"
instance_type     = "t3.micro"
disk_size_gb      = 20
ssh_key_name      = "decisionos-prod"
ssh_cidr_blocks   = ["0.0.0.0/0"]
git_repo          = "https://github.com/shafaypro/DecisionOS.git"
git_branch        = "main"
# domain left empty, so the app is HTTP-only on the Elastic IP
```

### 3.3 Terraform apply

```bash
cd deploy/aws-ec2
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Outputs:

```
app_url     = "http://<server-ip>"
instance_id = "<instance-id>"
public_ip   = "<server-ip>"
ssh_command = "ssh -i ~/.ssh/decisionos-prod.pem admin@<server-ip>"
```

> The `ssh_command` output assumes a `.pem` filename. With the ed25519 key above
> the actual command is `ssh -i ~/.ssh/decisionos-prod admin@<server-ip>`.

---

## 4. Bugs found and fixed in the bootstrap

The first boot left the app down. Several real defects in
`deploy/aws-ec2/startup.sh.tftpl` and the compose Caddy config had to be fixed.

### Bug 1: `docker-compose-plugin` is not a Debian package

```
apt-get install -y -qq docker.io docker-compose-plugin git curl jq
→ E: Unable to locate package docker-compose-plugin
```

Debian 12 has no `docker-compose-plugin` in its default repos. Because the script
runs under `set -euo pipefail`, this aborted the **entire** bootstrap on its first
command: no Docker, no clone, no app.

**Fix** (`startup.sh.tftpl`): install Docker from Docker's official apt repo:

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Bug 1b: t3.micro OOM risk during `next build`

The image build runs `npm ci` (full), `npm ci --omit=dev`, and `next build` on a
1 GB box. To avoid the OOM-killer, the fix also adds a 3 GB swapfile before the
build:

```bash
fallocate -l 3G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Bug 2: Caddy never receives `DOMAIN`, breaks IP-only access

`deploy/docker-compose/Caddyfile` uses `{$DOMAIN:localhost}`, but the `caddy`
service in `docker-compose.yml` has **no `environment`/`env_file`**, so `DOMAIN`
from `.env` is only used for compose interpolation and is never injected into the
caddy container. With no domain, Caddy fell back to the `localhost` site and would
not serve requests to the public IP.

**Fix used for this IP-only deploy:** default the site to `:80`:

```
{$DOMAIN::80} {
    reverse_proxy app:3000
}
```

> For a real domain with auto-TLS you must *also* pass `DOMAIN` into the caddy
> container (add `environment: [DOMAIN=${DOMAIN}]` to the `caddy` service), or
> Caddy won't know the hostname to request a certificate for.

### Bug 3b: session cookie is `Secure`, dropped over plain HTTP, login loops

After login, clicking any link bounced back to `/login`. `src/lib/session.ts` set
the session cookie with `secure: process.env.NODE_ENV === "production"`. This
deployment is `NODE_ENV=production` but served over **plain HTTP** (no domain/TLS),
so the browser **silently drops the `Secure` cookie**. The session never persists
and every request looks unauthenticated.

**Fix:** make `Secure` env-overridable (secure-by-default in production, opt-out for
HTTP-only deployments), wire `COOKIE_SECURE` into the compose `app` service, and set
`COOKIE_SECURE=false` in `.env`:

```ts
secure: process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production",
```

> The proper long-term fix is a domain plus HTTPS (Caddy auto-TLS), after which
> `COOKIE_SECURE` should be removed or set back to `true`.

### Bug 4: the repo is **private**, so the on-instance `git clone` fails

```
Cloning into '/opt/decisionos/app'...
fatal: could not read Username for 'https://github.com': No such device or address
```

`startup.sh.tftpl` does an anonymous `git clone` of
`https://github.com/shafaypro/DecisionOS.git`, but that repo is private.

**Workaround used** (least privilege: the repo stays private, no token on the box):
ship the local working tree to the instance and build from it.

```bash
# local
tar czf src.tar.gz --exclude=.git --exclude=node_modules --exclude=.next \
  --exclude='*.tfstate*' --exclude=terraform.tfvars --exclude=dev.db .
scp -i ~/.ssh/decisionos-prod src.tar.gz admin@<server-ip>:/tmp/

# instance
sudo tar xzf /tmp/src.tar.gz -C /opt/decisionos/app
sudo tee /opt/decisionos/.env   # SESSION_SECRET / POSTGRES_PASSWORD / CRON_SECRET / APP_URL / DOMAIN=:80
cd /opt/decisionos/app/deploy/docker-compose && ln -sf /opt/decisionos/.env .env
sudo docker compose up -d --build
```

**Reproducible alternatives** (pick one before re-deploying from scratch):
1. Make the GitHub repo public, **or**
2. Add a GitHub PAT / deploy key to `startup.sh.tftpl`'s clone URL
   (`https://<token>@github.com/...`) via a new sensitive Terraform variable, **or**
3. Keep shipping the tree out-of-band (what we did).

The cleanest durable answer is the off-box image build in §7, which removes the
on-box clone and build entirely.

---

## 5. Post-deploy

```bash
# health
curl -s http://<server-ip>/api/health
```

### Seeding demo data in production

The `/api/seed` route is **disabled when `NODE_ENV=production`**
(`{"error":"Not available in production"}`), so the documented `curl .../api/seed`
does **not** work on this deployment.

Instead, run the seeder (`prisma/seed.ts`) as a one-shot in the migrator image.
It picks the driver adapter from the `DATABASE_URL` scheme (Postgres vs SQLite,
mirroring `src/lib/prisma.ts`), so the same script works against the production
Postgres with no patching:

```bash
cd /opt/decisionos/app/deploy/docker-compose
sudo docker compose run --rm -T migrate npm run seed
# Result: 3 users, 1 workspace, 6 decisions. Login: admin@acme.demo / password123
```

### Logging in

Login is a **server action** (`src/actions/auth.ts`), not a REST route, so there is
no `/api/auth/login`. Sign in through the web UI at `http://<server-ip>/login`.

---

## 6. Operations

```bash
# SSH in
ssh -i ~/.ssh/decisionos-prod admin@<server-ip>

# container status / logs
cd /opt/decisionos/app/deploy/docker-compose
sudo docker compose ps
sudo docker compose logs -f app

# bootstrap / build logs
sudo cat /var/log/decisionos-startup.log
sudo cat /var/log/decisionos-recover.log
```

### Redeploy new code (private repo, ship tree)

```bash
# local
tar czf src.tar.gz --exclude=.git --exclude=node_modules --exclude=.next .
scp -i ~/.ssh/decisionos-prod src.tar.gz admin@<server-ip>:/tmp/
# instance
sudo tar xzf /tmp/src.tar.gz -C /opt/decisionos/app
cd /opt/decisionos/app/deploy/docker-compose && sudo docker compose build --no-cache app && sudo docker compose up -d app
# (the one-shot `migrate` service applies new migrations before app starts)
```

> **Use `build --no-cache` when redeploying shipped source.** Plain `--build`
> reused stale buildkit layers and silently shipped an *older* bundle even though
> the on-disk source was current (verified by grepping `.next` for a string
> unique to the new code). `--no-cache` guarantees the current tree compiles in.

### Building needs more RAM than running: resize to build, then back

`next build` (TypeScript check plus page-data collection) cannot complete on a
t3.micro (1 GB). It drives swap to ~93% iowait and wedges for 30+ min. The app
*runs* fine on t3.micro (~200 MB), so the cheapest reliable pattern is:

```bash
cd deploy/aws-ec2
# 1. resize up to build
sed -i 's/t3.micro/t3.small/' terraform.tfvars && terraform apply -auto-approve
# 2. ship tree, then `docker compose build --no-cache app && docker compose up -d app`  (~1 min compile on 2 GB)
# 3. resize back down to free-tier
sed -i 's/t3.small/t3.micro/' terraform.tfvars && terraform apply -auto-approve
```

Resizing is an **in-place stop/modify/start** (EBS root and docker volumes persist;
the containers auto-restart via `restart: unless-stopped`), so no data is lost.
Each resize costs only ~2-3 min of downtime. The proper long-term fix is to build
the image off-box and have the instance just pull it, covered in §7.

---

## 7. Off-box image builds, the recommended path

> **CI/CD runs on GitHub Actions.** [`release-images.yml`](https://github.com/shafaypro/DecisionOS/blob/main/.github/workflows/release-images.yml)
> builds the images and pushes them to **GHCR** when you publish a release (or push
> a `v*` tag); the box only pulls. This section documents that GHCR pull-based approach.

### What CI needs, and what it does not

Publishing to GHCR needs **no extra secrets** - the workflow uses the built-in
`GITHUB_TOKEN`. It deliberately does **not** SSH into or otherwise touch your
server: rolling the new images is a manual pull on the box (below), so there is no
private host address or SSH key stored in the repo. Deploying is decoupled from
publishing, which keeps this a public, fork-friendly workflow.

Notes:
- Repo → **Settings → Actions → General → Workflow permissions** must allow
  **Read and write** so the workflow can push to GHCR.
- Make the GHCR packages public (or grant your host a read token) if you want the
  box to pull without authenticating; the workflow logs in with `GITHUB_TOKEN`.
- No AWS credentials are involved - the pipeline is GitHub → GHCR → your host.

Building on the box is the root cause of the swap-thrash and resize dance above.
The durable fix is to build images in **CI** and have the instance only **pull**
them. A free-tier t3.micro can then serve indefinitely, because it never builds.

### How it works

- **`.github/workflows/release-images.yml`** builds the `runner` and `migrator`
  Dockerfile targets when a release is published or a `v*` tag is pushed (and on
  demand via *Run workflow*), then pushes them to GHCR:
  - `ghcr.io/<owner>/decisionos-app:<version>` (plus `:latest` and `:sha-<commit>`)
  - `ghcr.io/<owner>/decisionos-migrate:<version>` (plus `:latest` and `:sha-<commit>`)
- **`deploy/docker-compose/docker-compose.ghcr.yml`** is a pull-only compose:
  identical services, but `app` and `migrate` use `image:` instead of `build:`.

### One-time setup

1. **Let CI publish.** The workflow uses the built-in `GITHUB_TOKEN` with
   `packages: write`, so there is no secret to add. Publish a release / push a
   `v*` tag (or run *Actions → Publish images → Run workflow*) once to create the
   two GHCR packages.
2. **Choose package visibility** (the repo can stay private either way):
   - **Public packages** (simplest): GitHub → profile → Packages →
     `decisionos-app` / `decisionos-migrate` → Package settings → *Change
     visibility → Public*. The instance then pulls with **no login**.
   - **Private packages**: create a PAT with `read:packages` and log the instance
     in once (below).
3. **Switch the instance to the pull-based compose:**
   ```bash
   cd /opt/decisionos/app/deploy/docker-compose
   # private packages only, one time:
   echo "$GHCR_READ_TOKEN" | sudo docker login ghcr.io -u <github-user> --password-stdin
   sudo docker compose -f docker-compose.ghcr.yml pull
   sudo docker compose -f docker-compose.ghcr.yml up -d
   ```
   (The `.env` symlink with `SESSION_SECRET`, `POSTGRES_PASSWORD`, `COOKIE_SECURE`,
   `PLATFORM_ADMIN_EMAILS`, and the rest is reused unchanged.)

### Day-to-day deploys: no build, no resize

```bash
# 1. publish a release / push a v* tag, and CI builds + pushes images off-box (a few minutes)
# 2. on the instance:
cd /opt/decisionos/app/deploy/docker-compose
sudo docker compose -f docker-compose.ghcr.yml pull      # ~10s
sudo docker compose -f docker-compose.ghcr.yml up -d     # migrator runs, app rolls
```

Pin or roll back to an exact build with `IMAGE_TAG=sha-<commit>` in `.env`.
This removes the on-box build entirely, so the instance stays on free-tier
t3.micro permanently, with no swap thrash and no resize-to-build.

> Note: the EC2 first-boot bootstrap (`startup.sh.tftpl`) still builds on the box.
> Once GHCR images exist, point `startup.sh.tftpl` at `docker-compose.ghcr.yml`
> (with a `docker login` step for private packages) so that fresh instances pull
> too. This is left as a follow-up so the change does not alter the from-scratch path.

---

## 8. Teardown

```bash
cd deploy/aws-ec2
terraform destroy
aws ec2 delete-key-pair --region eu-west-1 --key-name decisionos-prod
```

`terraform destroy` removes the instance, EBS, Elastic IP, and VPC. The key pair
is not managed by Terraform (imported separately), so delete it manually.

---

## 9. Resource inventory (for cleanup reference)

| Resource | ID / value |
|---|---|
| Region | `eu-west-1` |
| Instance | `<instance-id>` (t3.micro) |
| Elastic IP | `<server-ip>` |
| Key pair | `decisionos-prod` (ed25519) |
| App URL | http://<server-ip> |
| Terraform state | `deploy/aws-ec2/terraform.tfstate` (local, git-ignored) |
