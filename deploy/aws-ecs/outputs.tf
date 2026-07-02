output "app_url" {
  description = "Public URL of the app (ALB DNS over HTTP until a custom domain + ACM cert is attached)."
  value       = "http://${aws_lb.this.dns_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name - point a CNAME / Route 53 alias here for a custom domain."
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository to build and push the image to (used by scripts/build-and-push.sh)."
  value       = aws_ecr_repository.this.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECS service name (use with `aws ecs update-service --force-new-deployment`)."
  value       = aws_ecs_service.this.name
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint (host:port). Not publicly reachable."
  value       = "${aws_db_instance.this.address}:${aws_db_instance.this.port}"
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint. Not publicly reachable."
  value       = "${aws_elasticache_cluster.this.cache_nodes[0].address}:6379"
}

output "log_group" {
  description = "CloudWatch Logs group for the app container."
  value       = aws_cloudwatch_log_group.app.name
}
