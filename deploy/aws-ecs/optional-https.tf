# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: HTTPS + custom domain.
#
# Everything here is DISABLED by default and creates nothing until you provide an
# ACM certificate. You don't have a domain yet, so leave `acm_certificate_arn`
# empty - the stack stays on HTTP via the ALB DNS name and this file is a no-op.
#
# When you're ready (see docs/OPERATIONS.md → "Adding HTTPS + a custom domain"):
#   1. Buy/move a domain into Route 53 (or any DNS provider).
#   2. Request an ACM cert IN THIS REGION covering the domain; validate it.
#   3. Set in terraform.tfvars:
#        acm_certificate_arn = "arn:aws:acm:<region>:<acct>:certificate/<id>"
#        domain_name         = "decisions.yourcompany.com"
#        route53_zone_id     = "Z0123..."   # optional: auto-create the DNS alias
#   4. terraform apply, then rebuild the image so NEXT_PUBLIC_APP_URL is baked in
#      (it is inlined into the client bundle at build time).
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  count = local.https_enabled ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# Optional Route 53 alias → ALB. Only when both domain_name and route53_zone_id
# are set; otherwise point your own DNS at the alb_dns_name output.
resource "aws_route53_record" "this" {
  count = local.https_enabled && var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
