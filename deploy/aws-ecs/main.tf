data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project_name}-${var.environment}"

  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # /24 public subnets (10.20.0.0/24, 10.20.1.0/24, ...) for ALB + Fargate.
  public_subnet_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i)]

  # /24 private subnets (10.20.10.0/24, ...) for RDS + Redis. No internet egress.
  private_subnet_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i + 10)]

  # Default to the ECR repo this stack creates, at :latest, unless overridden.
  container_image = var.container_image != "" ? var.container_image : "${aws_ecr_repository.this.repository_url}:latest"

  # HTTPS is enabled implicitly once an ACM cert is provided.
  https_enabled = var.acm_certificate_arn != ""
  http_redirect = local.https_enabled && var.redirect_http_to_https

  # Server-side base URL. Prefer an explicit app_url; otherwise derive from the
  # domain (if HTTPS) or fall back to the ALB DNS over HTTP.
  app_url = (
    var.app_url != "" ? var.app_url :
    local.https_enabled && var.domain_name != "" ? "https://${var.domain_name}" :
    "http://${aws_lb.this.dns_name}"
  )
}
