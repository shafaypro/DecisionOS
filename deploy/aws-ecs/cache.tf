resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.name}-redis"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "${local.name}-redis-subnet-group"
  }
}

# Single-node Redis for the lean starter. For HA, switch to a replication group
# with automatic_failover_enabled = true and >= 2 nodes.
resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${local.name}-redis"
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.redis.id]

  tags = {
    Name = "${local.name}-redis"
  }
}
