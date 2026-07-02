resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${local.name}-cluster"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name}-logs"
  }
}

locals {
  # Non-sensitive runtime config → plain environment.
  base_environment = {
    NODE_ENV            = "production"
    PORT                = tostring(var.container_port)
    HOSTNAME            = "0.0.0.0"
    NEXT_PUBLIC_APP_URL = local.app_url
    REDIS_URL           = local.redis_url
    DATABASE_POOL_MAX   = "5"
    LOG_LEVEL           = "info"
  }

  smtp_environment = local.smtp_enabled ? {
    SMTP_HOST = try(var.smtp_config.host, "")
    SMTP_PORT = try(var.smtp_config.port, "587")
    SMTP_USER = try(var.smtp_config.user, "")
    SMTP_FROM = try(var.smtp_config.from, "")
  } : {}

  container_environment = [
    for k, v in merge(local.base_environment, local.smtp_environment) : {
      name  = k
      value = v
    }
  ]

  # Sensitive runtime config → injected from Secrets Manager by the agent.
  container_secrets = [
    for k, s in aws_secretsmanager_secret.this : {
      name      = k
      valueFrom = s.arn
    }
  ]
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = local.name
      image     = local.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = local.container_environment
      secrets     = local.container_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])

  tags = {
    Name = "${local.name}-task"
  }
}

resource "aws_ecs_service" "this" {
  name            = local.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Migrations run on container start (CMD in the Dockerfile); give the task
  # time to migrate before the ALB starts failing it.
  health_check_grace_period_seconds = 180

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true # public subnet → pull image from ECR over the IGW
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = local.name
    container_port   = var.container_port
  }

  # The task definition pins the image to :latest, so the build script's
  # force-new-deployment re-pulls without changing the task def (no Terraform
  # drift). Leaving task_definition managed means env/CPU edits roll out on apply.

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy.execution_secrets,
    aws_secretsmanager_secret_version.this,
  ]

  tags = {
    Name = "${local.name}-service"
  }
}
