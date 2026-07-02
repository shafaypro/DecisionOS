#!/usr/bin/env bash
# Build the DecisionOS image, push it to the stack's ECR repo, and roll the ECS service.
#
# Reads ECR repo / cluster / service from `terraform output`, so run
# `terraform apply` at least once first.
#
#   ./scripts/build-and-push.sh              # build, push, deploy
#   SKIP_DEPLOY=1 ./scripts/build-and-push.sh # build + push only
set -euo pipefail

tf_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$tf_dir/../.." && pwd)"

tf_out() {
  local v
  v="$(terraform -chdir="$tf_dir" output -raw "$1" 2>/dev/null || true)"
  [ -n "$v" ] || { echo "terraform output '$1' is empty - run 'terraform apply' first." >&2; exit 1; }
  printf '%s' "$v"
}

ecr_url="$(tf_out ecr_repository_url)"
cluster="$(tf_out ecs_cluster_name)"
service="$(tf_out ecs_service_name)"
# <acct>.dkr.ecr.<region>.amazonaws.com
region="$(printf '%s' "$ecr_url" | cut -d. -f4)"
registry="${ecr_url%%/*}"
git_sha="$(git -C "$repo_root" rev-parse --short HEAD)"

echo "ECR repo : $ecr_url"
echo "Region   : $region"
echo "Tag      : sha-$git_sha (+ latest)"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry"

echo "==> Building image (context: $repo_root)..."
docker build -t "${ecr_url}:latest" -t "${ecr_url}:sha-${git_sha}" -f "$repo_root/Dockerfile" "$repo_root"

echo "==> Pushing..."
docker push "${ecr_url}:latest"
docker push "${ecr_url}:sha-${git_sha}"

if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
  echo "Done (skipped deploy). New image: ${ecr_url}:sha-${git_sha}"
  exit 0
fi

echo "==> Forcing new ECS deployment..."
aws ecs update-service --cluster "$cluster" --service "$service" --force-new-deployment --region "$region" >/dev/null

echo "Deployment triggered. Watch rollout with:"
echo "  aws ecs wait services-stable --cluster $cluster --services $service --region $region"
