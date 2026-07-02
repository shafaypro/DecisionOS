variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used to prefix and tag all resources."
  type        = string
  default     = "decisionos"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project_name))
    error_message = "project_name must be lowercase alphanumeric/hyphen, 2-21 chars, starting with a letter."
  }
}

variable "environment" {
  description = "Environment name for tagging (e.g. prod, staging)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across (RDS/ElastiCache subnet groups require >= 2)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3."
  }
}

# ── Application container ────────────────────────────────────────────────────
variable "container_image" {
  description = "Full image reference (repo:tag) to run. Defaults to the stack's own ECR repo at the 'latest' tag; override to pin a digest/tag."
  type        = string
  default     = ""
}

variable "container_port" {
  description = "Port the Next.js server listens on (matches the Dockerfile)."
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Number of Fargate tasks. Keep at 1 for the lean starter (DB migrations run on task start; see README before scaling)."
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "app_url" {
  description = "Public base URL of the app (used for magic links, share CTAs). Leave empty to use the ALB DNS over HTTP; set to your https://domain once you attach a custom domain + ACM cert."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the app container."
  type        = number
  default     = 30
}

# ── Database (RDS Postgres) ──────────────────────────────────────────────────
variable "db_name" {
  description = "Initial Postgres database name."
  type        = string
  default     = "decisionos"
}

variable "db_username" {
  description = "Postgres master username."
  type        = string
  default     = "decisionos"
}

variable "db_instance_class" {
  description = "RDS instance class (lean starter default)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "Postgres engine version."
  type        = string
  default     = "16"
}

# ── Cache (ElastiCache Redis) ────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type (lean starter default)."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

# ── Optional app integrations (passed straight to the container env) ─────────
# Leave empty to disable. Secrets here are written to AWS Secrets Manager.
variable "smtp_config" {
  description = "Optional SMTP settings for email. All-or-nothing; leave empty to disable email."
  type = object({
    host = optional(string, "")
    port = optional(string, "587")
    user = optional(string, "")
    pass = optional(string, "")
    from = optional(string, "")
  })
  default   = {}
  sensitive = true
}

variable "cron_secret" {
  description = "Optional bearer token required by /api/cron/* routes. Generated if left empty."
  type        = string
  default     = ""
  sensitive   = true
}

# ── HTTPS / custom domain (optional - see optional-https.tf) ─────────────────
# Disabled until you own a domain and have an ACM cert. Leaving these empty keeps
# the lean starter on HTTP via the ALB DNS name.
variable "acm_certificate_arn" {
  description = "ARN of an ACM certificate (in this region) covering your domain. When set, an HTTPS :443 listener is added to the ALB. Leave empty to stay HTTP-only."
  type        = string
  default     = ""
}

variable "redirect_http_to_https" {
  description = "When HTTPS is enabled, redirect port 80 to 443 instead of serving the app over HTTP."
  type        = bool
  default     = true
}

variable "domain_name" {
  description = "Custom domain (e.g. decisions.yourcompany.com). Only used to create a Route 53 alias when route53_zone_id is also set."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for domain_name. When set with domain_name, an alias record to the ALB is created. Leave empty to manage DNS yourself."
  type        = string
  default     = ""
}

# ── Scheduled cron jobs (optional - see optional-scheduled-jobs.tf) ──────────
# EventBridge API destinations require an HTTPS endpoint, so this needs HTTPS
# (acm_certificate_arn) configured first. Replaces the vercel.json crons.
variable "enable_scheduled_jobs" {
  description = "Create EventBridge schedules that call /api/cron/review-reminders (daily), /api/cron/weekly-digest (weekly), and /api/cron/audit-retention (daily) with the CRON_SECRET. Requires HTTPS (acm_certificate_arn)."
  type        = bool
  default     = false
}

variable "review_reminders_schedule" {
  description = "EventBridge cron() expression for review reminders (UTC)."
  type        = string
  default     = "cron(0 8 * * ? *)" # daily 08:00 UTC
}

variable "weekly_digest_schedule" {
  description = "EventBridge cron() expression for the weekly digest (UTC)."
  type        = string
  default     = "cron(0 9 ? * MON *)" # Mondays 09:00 UTC
}

variable "audit_retention_schedule" {
  description = "EventBridge cron() expression for the audit-log retention purge (UTC)."
  type        = string
  default     = "cron(37 3 * * ? *)" # daily 03:37 UTC
}
