# Generated secrets. special=false keeps them URL/shell safe (DATABASE_URL embeds
# the DB password). SESSION_SECRET must stay STABLE across deploys - rotating it
# invalidates all sessions and makes stored Slack/SSO secrets unreadable, so it
# lives in Terraform state and is only recreated if explicitly tainted.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "random_password" "cron_secret" {
  length  = 32
  special = false
}

locals {
  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"
  redis_url    = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:6379"
  cron_secret  = var.cron_secret != "" ? var.cron_secret : random_password.cron_secret.result

  smtp_enabled = try(var.smtp_config.host, "") != ""

  # Sensitive values injected into the container via Secrets Manager (valueFrom).
  secret_values = merge(
    {
      SESSION_SECRET = random_password.session_secret.result
      DATABASE_URL   = local.database_url
      CRON_SECRET    = local.cron_secret
    },
    local.smtp_enabled ? { SMTP_PASS = try(var.smtp_config.pass, "") } : {}
  )
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secret_values

  name                    = "${local.name}/${each.key}"
  recovery_window_in_days = 0 # lean starter: allow immediate delete + recreate

  tags = {
    Name = "${local.name}-${lower(each.key)}"
  }
}

resource "aws_secretsmanager_secret_version" "this" {
  for_each = local.secret_values

  secret_id     = aws_secretsmanager_secret.this[each.key].id
  secret_string = each.value
}
