# Kubernetes Deployment

Deploy DecisionOS to any conformant Kubernetes cluster (EKS, GKE, AKS, k3s, etc.)
using Kustomize-based manifests.

## Architecture

```
Ingress (nginx/traefik/ALB) → Service → Deployment (N replicas, HPA)
                                         ├─ Pod: decisionos:latest
                                         └─ Pod: decisionos:latest
                                              ↓
                               External Postgres + Redis
```

**Prerequisites:**
- Kubernetes 1.27+
- An Ingress controller (nginx-ingress, traefik, AWS ALB controller)
- cert-manager (for automatic TLS) - optional
- External Postgres database (RDS, Cloud SQL, managed provider)
- External Redis (ElastiCache, Memorystore) - optional but recommended for multi-replica

## Quick start

```bash
cd deploy/kubernetes

# 1. Edit the secret template with real values
#    Generate: echo -n "value" | base64
vi base/secret.yaml

# 2. Update the Ingress hostname
vi base/ingress.yaml   # or use the production overlay

# 3. Apply base manifests
kubectl apply -k base/

# 4. Run migrations
kubectl apply -f base/migration-job.yaml
kubectl wait --for=condition=complete job/decisionos-migrate -n decisionos --timeout=120s

# 5. Seed demo data (optional)
kubectl exec -n decisionos deploy/decisionos -- \
  curl -sS -X POST http://localhost:3000/api/seed
```

## Using Kustomize overlays

The `overlays/production/` directory demonstrates how to customize for production:

```bash
# Edit the overlay to set your registry, domain, and resource limits
vi overlays/production/kustomization.yaml

# Apply
kubectl apply -k overlays/production/
```

Create additional overlays for staging, dev, etc.:
```
overlays/
├── production/
│   └── kustomization.yaml
├── staging/
│   └── kustomization.yaml
└── dev/
    └── kustomization.yaml
```

## Container images

Build and push to your registry:

```bash
# Build
docker build -t your-registry/decisionos:v1.0.0 --target runner .
docker build -t your-registry/decisionos-migrator:v1.0.0 --target migrator .

# Push
docker push your-registry/decisionos:v1.0.0
docker push your-registry/decisionos-migrator:v1.0.0

# Update the overlay
cd deploy/kubernetes/overlays/production
kustomize edit set image decisionos=your-registry/decisionos:v1.0.0
```

## Deployment workflow

For each release:

```bash
# 1. Build and push new images
docker build -t registry/decisionos:v1.1.0 --target runner .
docker push registry/decisionos:v1.1.0

# 2. Run migrations
kubectl delete job decisionos-migrate -n decisionos --ignore-not-found
kubectl apply -f base/migration-job.yaml
kubectl wait --for=condition=complete job/decisionos-migrate -n decisionos --timeout=120s

# 3. Update deployment image
kubectl set image -n decisionos deployment/decisionos app=registry/decisionos:v1.1.0

# 4. Watch rollout
kubectl rollout status -n decisionos deployment/decisionos
```

## What's included

| Resource | File | Purpose |
|----------|------|---------|
| Namespace | `namespace.yaml` | Isolated namespace |
| ServiceAccount | `serviceaccount.yaml` | Pod identity |
| ConfigMap | `configmap.yaml` | Non-sensitive config |
| Secret | `secret.yaml` | Sensitive config (template) |
| Deployment | `deployment.yaml` | App pods with health checks |
| Service | `service.yaml` | ClusterIP load balancer |
| Ingress | `ingress.yaml` | External access + TLS |
| HPA | `hpa.yaml` | Auto-scaling (2-10 replicas) |
| PDB | `pdb.yaml` | Disruption budget (min 1 available) |
| Job | `migration-job.yaml` | One-shot DB migration |
| CronJob | `cronjob.yaml` | Review reminders + weekly digest |

## External secrets

For production, replace the static `secret.yaml` with an external secrets operator:

- **AWS:** [external-secrets-operator](https://external-secrets.io/) + Secrets Manager
- **GCP:** external-secrets-operator + Secret Manager
- **Vault:** external-secrets-operator + HashiCorp Vault

## Monitoring

```bash
# Pod status
kubectl get pods -n decisionos

# Logs
kubectl logs -n decisionos -l app.kubernetes.io/name=decisionos -f

# Events
kubectl get events -n decisionos --sort-by='.lastTimestamp'

# HPA status
kubectl get hpa -n decisionos
```
