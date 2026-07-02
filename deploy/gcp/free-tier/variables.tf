variable "project_id" {
  description = "GCP project ID with billing enabled."
  type        = string
}

variable "name" {
  description = "Name prefix for DecisionOS resources."
  type        = string
  default     = "decisionos"
}

variable "region" {
  description = "Free-tier eligible region. Valid free-tier choices are us-central1, us-east1, and us-west1."
  type        = string
  default     = "us-central1"

  validation {
    condition     = contains(["us-central1", "us-east1", "us-west1"], var.region)
    error_message = "Use us-central1, us-east1, or us-west1 to stay aligned with the Compute Engine free-tier regions."
  }
}

variable "zone" {
  description = "Zone inside the selected region."
  type        = string
  default     = "us-central1-a"
}

variable "repo_url" {
  description = "Git repository URL that the VM can clone."
  type        = string
  default     = "https://github.com/shafaypro/DecisionOS.git"
}

variable "repo_ref" {
  description = "Branch, tag, or ref to deploy."
  type        = string
  default     = "dev2"
}

variable "domain_name" {
  description = "Optional domain name for HTTPS. Leave empty to serve HTTP on the VM IP."
  type        = string
  default     = ""
}

variable "use_static_ip" {
  description = "Reserve and attach a static IPv4 address. Recommended when domain_name is set. External IPv4 addresses can incur charges."
  type        = bool
  default     = false
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to reach SSH. Defaults to Google IAP TCP forwarding only."
  type        = list(string)
  default     = ["35.235.240.0/20"]
}

variable "session_secret" {
  description = "Optional production session secret. If blank, the VM generates and preserves one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cron_secret" {
  description = "Optional bearer token for cron endpoints. If blank, the VM generates and preserves one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_host" {
  description = "Optional SMTP host for email notifications."
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "Optional SMTP port."
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "Optional SMTP username."
  type        = string
  default     = ""
}

variable "smtp_pass" {
  description = "Optional SMTP password."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  description = "Optional SMTP from address."
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Optional Anthropic API key for AI drafting."
  type        = string
  default     = ""
  sensitive   = true
}
