variable "project" {
  description = "Project name (used for resource naming)"
  type        = string
  default     = "decisionos"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "disk_size_gb" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 20
}

variable "ssh_key_name" {
  description = "EC2 key pair name for SSH access (leave empty to disable SSH key login)"
  type        = string
  default     = ""
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ── Application secrets ──────────────────────────────────────────────

variable "session_secret" {
  description = "SESSION_SECRET - openssl rand -hex 32"
  type        = string
  sensitive   = true
}

variable "postgres_password" {
  description = "Postgres password - openssl rand -hex 16"
  type        = string
  sensitive   = true
}

variable "cron_secret" {
  description = "CRON_SECRET for scheduled endpoints - openssl rand -hex 16"
  type        = string
  sensitive   = true
}

# ── Domain & TLS ─────────────────────────────────────────────────────

variable "domain" {
  description = "Domain name pointing to the Elastic IP (leave empty for IP-only access)"
  type        = string
  default     = ""
}

variable "git_repo" {
  description = "Git repository URL to clone"
  type        = string
  default     = "https://github.com/shafaypro/DecisionOS.git"
}

variable "git_branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

# ── Optional integrations ───────────────────────────────────────────

variable "smtp_host" {
  type    = string
  default = ""
}

variable "smtp_port" {
  type    = string
  default = "587"
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "smtp_pass" {
  type      = string
  default   = ""
  sensitive = true
}

variable "smtp_from" {
  type    = string
  default = ""
}

variable "anthropic_api_key" {
  type      = string
  default   = ""
  sensitive = true
}
