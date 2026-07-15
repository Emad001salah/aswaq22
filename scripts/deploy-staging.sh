#!/usr/bin/env bash
# =============================================================================
# deploy-staging.sh — Automated Local-to-Cloud Staging Deploy & Verification
# =============================================================================
# PREREQUISITES:
#   - AWS CLI configured with credentials
#   - kubectl, helm, and terraform installed
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="aswaq-staging"
CLUSTER_NAME="aswaq-cluster-staging"
REGION="me-south-1"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[Staging]${NC} $*"; }
ok()   { echo -e "${GREEN}[Staging] OK:${NC} $*"; }
warn() { echo -e "${YELLOW}[Staging] WARN:${NC} $*"; }
error(){ echo -e "${RED}[Staging] ERROR:${NC} $*" >&2; }

# ─── 1. Terraform Apply ──────────────────────────────────────────────────────
log "Starting Terraform provisioning on Staging..."
cd "${PROJECT_ROOT}/terraform"

terraform init
terraform validate

log "Running terraform apply..."
terraform apply -var="environment=staging" -auto-approve

ok "Infrastructure provisioned successfully via Terraform."

# ─── 2. Setup kubeconfig ─────────────────────────────────────────────────────
log "Configuring kubectl credentials for cluster: ${CLUSTER_NAME}..."
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

# ─── 3. Helm deploy ──────────────────────────────────────────────────────────
log "Linting Helm chart..."
cd "$PROJECT_ROOT"
helm lint helm/ --strict

log "Deploying application to Kubernetes staging namespace..."
# Fetch the latest local git commit hash to tag the build
IMAGE_TAG=$(git rev-parse --short HEAD)

helm upgrade --install aswaq helm/ \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --set image.tag="$IMAGE_TAG" \
  --atomic \
  --timeout 5m

ok "Helm deployment complete."

# ─── 4. Database Migrations & Seeding ───────────────────────────────────────
log "Waiting for application pods to be ready..."
kubectl rollout status deployment/aswaq -n "$NAMESPACE" --timeout=180s

APP_POD=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')

log "Running database migrations on Staging..."
kubectl exec -n "$NAMESPACE" "$APP_POD" -- npx prisma migrate deploy

log "Seeding database on Staging..."
kubectl exec -n "$NAMESPACE" "$APP_POD" -- npm run test:seed

ok "Database migrated and seeded successfully."

# ─── 5. Health & Verification ───────────────────────────────────────────────
log "Running local verification tests against Staging API..."
STAGING_URL="https://staging.api.aswaq.sa"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_URL}/health" --max-time 15 || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  ok "Staging API is healthy and reachable (HTTP 200)!"
else
  error "Staging health check failed (HTTP ${HTTP_CODE})"
  exit 1
fi

log "Checking public status page..."
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_URL}/status" --max-time 10 || echo "000")
if [[ "$STATUS_CODE" == "200" || "$STATUS_CODE" == "304" ]]; then
  ok "Public Status Page is live and accessible!"
else
  warn "Public Status Page returned HTTP ${STATUS_CODE}"
fi

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  STAGING DEPLOYMENT & VERIFICATION COMPLETE        ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "  API URL     : ${STAGING_URL}"
echo -e "  Status Page : ${STAGING_URL}/status"
echo -e "  Pod Name    : ${APP_POD}"
echo -e "${GREEN}====================================================${NC}"
echo ""
