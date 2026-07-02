resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-db"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = {
    Name = "${local.name}-db-subnet-group"
  }
}

resource "aws_db_instance" "this" {
  identifier     = "${local.name}-pg"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # allow storage autoscaling headroom
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  multi_az                = false # lean starter; flip to true for HA
  backup_retention_period = 7
  deletion_protection     = false # lean starter; set true for production data
  skip_final_snapshot     = true  # lean starter; set false + final_snapshot_identifier for production

  apply_immediately = true

  tags = {
    Name = "${local.name}-pg"
  }
}
