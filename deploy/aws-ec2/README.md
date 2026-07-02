# AWS EC2 - Single Instance Deployment

Run DecisionOS on a single EC2 instance with Docker Compose. Good for small teams
(< 50 users) who want AWS-managed infrastructure without the complexity of ECS.

## Architecture

```
Internet → Elastic IP → EC2 (t3.micro)
                          ├─ Caddy (:80/:443, auto-TLS)
                          ├─ App (:3000)
                          ├─ Postgres (:5432)
                          └─ Redis (:6379)
```

**Cost:** ~$8/mo (t3.micro + 20 GB gp3 + Elastic IP). No RDS, no ALB, no NAT Gateway.

## Prerequisites

- AWS account with credentials configured (`aws configure`)
- Terraform >= 1.5
- A domain name (optional, for auto-TLS)

## Setup

```bash
cd deploy/aws-ec2

# 1. Configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars - set session_secret, postgres_password, cron_secret

# 2. Deploy
terraform init
terraform apply

# 3. Note the outputs
terraform output
# app_url    = "http://X.X.X.X"      (or https://your-domain.com)
# public_ip  = "X.X.X.X"
# ssh_command = "ssh -i ..."

# 4. Wait ~3 minutes for startup, then seed
curl -X POST $(terraform output -raw app_url)/api/seed
```

## Domain setup

1. Set `domain = "decisions.example.com"` in `terraform.tfvars`
2. Run `terraform apply`
3. Create a DNS A record: `decisions.example.com → <public_ip from output>`
4. Caddy auto-provisions a Let's Encrypt certificate

## Upgrades

SSH into the instance and pull the latest code:

```bash
ssh admin@<IP>
cd /opt/decisionos/app
sudo git pull origin main
cd deploy/docker-compose
sudo docker compose up -d --build
```

Or re-run Terraform to recreate the instance (will trigger a fresh clone + build):

```bash
terraform taint aws_instance.this
terraform apply
```

## Monitoring

```bash
# Service health
curl -s https://your-domain.com/api/health | jq

# SSH in and check containers
ssh admin@<IP>
cd /opt/decisionos/app/deploy/docker-compose
sudo docker compose ps
sudo docker compose logs -f app
```

## Scaling up

When you outgrow a single instance:

1. **Vertical:** Change `instance_type` to `t3.small` or `t3.medium` in `terraform.tfvars`
2. **Horizontal:** Migrate to the `deploy/aws-ecs/` pattern (ALB + Fargate + RDS + ElastiCache)
