#Requires -Version 5.1
<#
.SYNOPSIS
  Build the DecisionOS image, push it to the stack's ECR repo, and roll the ECS service.

.DESCRIPTION
  Reads the ECR repo URL, region, cluster and service name from `terraform output`,
  so run `terraform apply` at least once first. Builds the repo-root Dockerfile,
  tags it :latest and :<git-sha>, pushes both, then forces a new ECS deployment.

.EXAMPLE
  ./scripts/build-and-push.ps1
  ./scripts/build-and-push.ps1 -SkipDeploy   # build + push only
#>
param(
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

# Resolve paths: this script lives in deploy/aws-ecs/scripts; the Terraform root
# is its parent, the app repo root is three levels up.
$tfDir   = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $tfDir)

function Get-TfOutput($name) {
  $val = terraform -chdir="$tfDir" output -raw $name 2>$null
  if ([string]::IsNullOrWhiteSpace($val)) { throw "terraform output '$name' is empty - run 'terraform apply' first." }
  return $val.Trim()
}

$ecrUrl  = Get-TfOutput "ecr_repository_url"
$cluster = Get-TfOutput "ecs_cluster_name"
$service = Get-TfOutput "ecs_service_name"

# Derive the region from the ECR registry host: <acct>.dkr.ecr.<region>.amazonaws.com
$region = ($ecrUrl -split '\.')[3]

$registry = ($ecrUrl -split '/')[0]
$gitSha   = (git -C $repoRoot rev-parse --short HEAD).Trim()

Write-Host "ECR repo : $ecrUrl"
Write-Host "Region   : $region"
Write-Host "Tag      : sha-$gitSha (+ latest)"

Write-Host "`n==> Logging in to ECR..."
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $registry

Write-Host "`n==> Building image (context: $repoRoot)..."
docker build -t "${ecrUrl}:latest" -t "${ecrUrl}:sha-$gitSha" -f "$repoRoot/Dockerfile" $repoRoot

Write-Host "`n==> Pushing..."
docker push "${ecrUrl}:latest"
docker push "${ecrUrl}:sha-$gitSha"

if ($SkipDeploy) {
  Write-Host "`nDone (skipped deploy). New image: ${ecrUrl}:sha-$gitSha"
  exit 0
}

Write-Host "`n==> Forcing new ECS deployment..."
aws ecs update-service --cluster $cluster --service $service --force-new-deployment --region $region | Out-Null

Write-Host "`nDeployment triggered. Watch rollout with:"
Write-Host "  aws ecs wait services-stable --cluster $cluster --services $service --region $region"
