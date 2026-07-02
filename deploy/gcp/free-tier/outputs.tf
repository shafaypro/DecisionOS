output "external_ip" {
  description = "Public IPv4 address for the DecisionOS VM."
  value       = google_compute_instance.decisionos.network_interface[0].access_config[0].nat_ip
}

output "app_url" {
  description = "URL to open after bootstrap completes."
  value       = var.domain_name == "" ? "http://${google_compute_instance.decisionos.network_interface[0].access_config[0].nat_ip}" : "https://${var.domain_name}"
}

output "ssh_command" {
  description = "IAP SSH command for VM troubleshooting."
  value       = "gcloud compute ssh ${google_compute_instance.decisionos.name} --zone ${var.zone} --tunnel-through-iap"
}

output "startup_log_command" {
  description = "Command to inspect bootstrap logs."
  value       = "sudo tail -n 200 /var/log/decisionos-startup.log"
}
