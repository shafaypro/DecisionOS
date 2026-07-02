# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: scheduled cron jobs (replaces vercel.json crons, which only run on
# Vercel). DISABLED by default - set enable_scheduled_jobs = true to create.
#
# Uses EventBridge rules → API destinations to POST to the app's /api/cron/*
# routes with `Authorization: Bearer <CRON_SECRET>`. EventBridge API destinations
# REQUIRE AN HTTPS ENDPOINT, so this needs HTTPS configured first
# (acm_certificate_arn + domain) - which is why it's grouped with the domain work
# you're not doing yet. The precondition below enforces that.
#
# Schedules (override via *_schedule vars, UTC):
#   review-reminders → daily 08:00      (var.review_reminders_schedule)
#   weekly-digest    → Mondays 09:00    (var.weekly_digest_schedule)
#   audit-retention  → daily 03:37      (var.audit_retention_schedule)
# ─────────────────────────────────────────────────────────────────────────────

locals {
  cron_jobs = var.enable_scheduled_jobs ? {
    review-reminders = {
      path     = "/api/cron/review-reminders"
      schedule = var.review_reminders_schedule
    }
    weekly-digest = {
      path     = "/api/cron/weekly-digest"
      schedule = var.weekly_digest_schedule
    }
    audit-retention = {
      path     = "/api/cron/audit-retention"
      schedule = var.audit_retention_schedule
    }
  } : {}
}

# Holds the bearer token EventBridge sends on every invocation.
resource "aws_cloudwatch_event_connection" "cron" {
  count = var.enable_scheduled_jobs ? 1 : 0

  name               = "${local.name}-cron"
  description        = "Auth for DecisionOS cron API destinations"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${local.cron_secret}"
    }
  }

  lifecycle {
    precondition {
      condition     = startswith(local.app_url, "https://")
      error_message = "enable_scheduled_jobs requires an HTTPS endpoint. Set acm_certificate_arn (and domain_name/app_url) before enabling scheduled jobs."
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "cron" {
  for_each = local.cron_jobs

  name                             = "${local.name}-${each.key}"
  connection_arn                   = aws_cloudwatch_event_connection.cron[0].arn
  invocation_endpoint              = "${local.app_url}${each.value.path}"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
}

resource "aws_cloudwatch_event_rule" "cron" {
  for_each = local.cron_jobs

  name                = "${local.name}-${each.key}"
  description         = "DecisionOS ${each.key}"
  schedule_expression = each.value.schedule
}

resource "aws_cloudwatch_event_target" "cron" {
  for_each = local.cron_jobs

  rule     = aws_cloudwatch_event_rule.cron[each.key].name
  arn      = aws_cloudwatch_event_api_destination.cron[each.key].arn
  role_arn = aws_iam_role.events_invoke[0].arn
}

# ── IAM: let EventBridge invoke the API destinations ────────────────────────
data "aws_iam_policy_document" "events_assume" {
  count = var.enable_scheduled_jobs ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events_invoke" {
  count              = var.enable_scheduled_jobs ? 1 : 0
  name               = "${local.name}-events-invoke"
  assume_role_policy = data.aws_iam_policy_document.events_assume[0].json
}

data "aws_iam_policy_document" "events_invoke" {
  count = var.enable_scheduled_jobs ? 1 : 0

  statement {
    sid       = "InvokeCronApiDestinations"
    actions   = ["events:InvokeApiDestination"]
    resources = [for d in aws_cloudwatch_event_api_destination.cron : d.arn]
  }
}

resource "aws_iam_role_policy" "events_invoke" {
  count  = var.enable_scheduled_jobs ? 1 : 0
  name   = "${local.name}-invoke-api-destinations"
  role   = aws_iam_role.events_invoke[0].id
  policy = data.aws_iam_policy_document.events_invoke[0].json
}
