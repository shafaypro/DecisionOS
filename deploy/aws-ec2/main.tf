# DecisionOS - Single EC2 Instance Deployment
#
# Creates: VPC + public subnet + EC2 (t3.micro) + EBS + Elastic IP +
# Docker Compose (Postgres + Redis + App + Caddy).
#
# Cost: ~$8-15/mo (t3.micro + 20 GB EBS + Elastic IP).

locals {
  name = "${var.project}-${var.environment}"

  user_data_vars = {
    project          = var.project
    git_repo         = var.git_repo
    git_branch       = var.git_branch
    domain           = var.domain
    session_secret   = var.session_secret
    postgres_password = var.postgres_password
    cron_secret      = var.cron_secret
    app_url          = var.domain != "" ? "https://${var.domain}" : "http://${aws_eip.this.public_ip}"
    smtp_host        = var.smtp_host
    smtp_port        = var.smtp_port
    smtp_user        = var.smtp_user
    smtp_pass        = var.smtp_pass
    smtp_from        = var.smtp_from
    anthropic_api_key = var.anthropic_api_key
  }
}

# ── VPC ──────────────────────────────────────────────────────────────
resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${local.name}-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ── Security Group ───────────────────────────────────────────────────
resource "aws_security_group" "instance" {
  name_prefix = "${local.name}-"
  vpc_id      = aws_vpc.this.id
  description = "DecisionOS EC2 instance"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-sg" }
}

# ── EC2 Instance ─────────────────────────────────────────────────────
resource "aws_instance" "this" {
  ami                    = data.aws_ami.debian.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.instance.id]
  key_name               = var.ssh_key_name != "" ? var.ssh_key_name : null

  root_block_device {
    volume_size = var.disk_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/startup.sh.tftpl", local.user_data_vars)

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  tags = { Name = local.name }
}

data "aws_ami" "debian" {
  most_recent = true
  owners      = ["136693071363"] # Debian official

  filter {
    name   = "name"
    values = ["debian-12-amd64-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── Elastic IP ───────────────────────────────────────────────────────
resource "aws_eip" "this" {
  domain = "vpc"
  tags   = { Name = "${local.name}-eip" }
}

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}
