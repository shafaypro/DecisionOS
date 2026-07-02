provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iap" {
  project            = var.project_id
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  project            = var.project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_compute_network" "decisionos" {
  name                    = "${var.name}-network"
  auto_create_subnetworks = false

  depends_on = [google_project_service.compute]
}

resource "google_compute_subnetwork" "decisionos" {
  name          = "${var.name}-subnet"
  ip_cidr_range = "10.42.0.0/24"
  region        = var.region
  network       = google_compute_network.decisionos.id
}

resource "google_compute_firewall" "web" {
  name    = "${var.name}-allow-web"
  network = google_compute_network.decisionos.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.name}-web"]
}

resource "google_compute_firewall" "ssh" {
  name    = "${var.name}-allow-ssh"
  network = google_compute_network.decisionos.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = ["${var.name}-ssh"]
}

resource "google_service_account" "vm" {
  account_id   = "${var.name}-vm"
  display_name = "DecisionOS VM service account"

  depends_on = [google_project_service.iam]
}

resource "google_compute_address" "decisionos" {
  count        = var.use_static_ip ? 1 : 0
  name         = "${var.name}-ip"
  region       = var.region
  network_tier = "STANDARD"
}

resource "google_compute_instance" "decisionos" {
  name         = var.name
  machine_type = "e2-micro"
  zone         = var.zone
  tags         = ["${var.name}-web", "${var.name}-ssh"]

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "projects/debian-cloud/global/images/family/debian-12"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.decisionos.id

    access_config {
      nat_ip       = var.use_static_ip ? google_compute_address.decisionos[0].address : null
      network_tier = "STANDARD"
    }
  }

  metadata = {
    enable-oslogin         = "TRUE"
    block-project-ssh-keys = "TRUE"
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh.tftpl", {
    repo_url_b64            = base64encode(var.repo_url)
    repo_ref_b64            = base64encode(var.repo_ref)
    domain_name_b64         = base64encode(var.domain_name)
    next_public_app_url_b64 = base64encode(var.domain_name == "" ? "" : "https://${var.domain_name}")
    session_secret_b64      = base64encode(var.session_secret)
    cron_secret_b64         = base64encode(var.cron_secret)
    smtp_host_b64           = base64encode(var.smtp_host)
    smtp_port_b64           = base64encode(var.smtp_port)
    smtp_user_b64           = base64encode(var.smtp_user)
    smtp_pass_b64           = base64encode(var.smtp_pass)
    smtp_from_b64           = base64encode(var.smtp_from)
    anthropic_api_key_b64   = base64encode(var.anthropic_api_key)
  })

  service_account {
    email = google_service_account.vm.email
    scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
    ]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  lifecycle {
    precondition {
      condition     = var.domain_name == "" || var.use_static_ip
      error_message = "Set use_static_ip=true when domain_name is set so DNS has a stable address."
    }
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.iap,
    google_project_service.iam,
  ]
}
