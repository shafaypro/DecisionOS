output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.this.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.this.public_ip
}

output "app_url" {
  description = "Application URL"
  value       = var.domain != "" ? "https://${var.domain}" : "http://${aws_eip.this.public_ip}"
}

output "ssh_command" {
  description = "SSH command (if key pair configured)"
  value       = var.ssh_key_name != "" ? "ssh -i ~/.ssh/${var.ssh_key_name}.pem admin@${aws_eip.this.public_ip}" : "No SSH key configured"
}
