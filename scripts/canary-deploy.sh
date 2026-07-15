#!/usr/bin/env bash
# =============================================================================
# canary-deploy.sh — Blue/Green & Canary Deployment for Aswaq
# =============================================================================
# USAGE:
#   ./scripts/canary-deploy.sh <canary|promote|rollback|blue-green> [OPTIONS]
#
# STRATEGIES:
#   canary      — Deploy new version to 10% of traffic, monitor, then promote
#   promote     — Promote canary to 100% traffic
#   rollback    — Rollback to previous version (< 5 minutes)
#   blue-green  — Full blue/green deployment with instant switch
#
# OPTIONS:
#   --image-tag <tag>        Docker image tag to deploy
#   --weight    <0-100>      Canary traffic weight (default: 10)
#   --env       <staging|production>
#   --dry-run                Simulate without applying changes
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Defaults ─────────────────────────────────────────────────────────────────
COMMAND="${1:-help}"
IMAGE_TAG=""
CANARY_WEIGHT=10
ENVIRONMENT="staging"
NAMESPACE="aswaq-staging"
DRY_RUN=false
HELM_CHART="${PROJECT_ROOT}/helm"
ROLLBACK_TIMEOUT=120

# ─── Parse args ───────────────────────────────────────────────────────────────
shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    --image-tag)  IMAGE_TAG="$2"; shift 2 ;;
    --weight)     CANARY_WEIGHT="$2"; shift 2 ;;
    --env)        ENVIRONMENT="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
error(){ echo -e "${RED}[✕]${NC} $*" >&2; }
step() { echo -e "\n${CYAN}${BOLD}══ $* ══${NC}"; }
dry()  { [[ "$DRY_RUN" == "true" ]] && warn "[DRY RUN] $*" && return 0; return 1; }

# Adjust namespace based on environment
[[ "$ENVIRONMENT" == "production" ]] && NAMESPACE="aswaq"

RELEASE_NAME="aswaq"
CANARY_RELEASE="aswaq-canary"

# ─── Health gate: verify a deployment is healthy ──────────────────────────────
health_gate() {
  local url="${1:-https://api.aswaq.sa/health}"
  local attempts="${2:-10}"
  local wait_s="${3:-10}"

  log "Running health gate against: $url"

  for i in $(seq 1 "$attempts"); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
      ok "Health gate PASSED (attempt $i/$attempts)"
      return 0
    fi
    warn "Attempt $i/$attempts failed (HTTP $HTTP_CODE) — waiting ${wait_s}s..."
    sleep "$wait_s"
  done

  error "Health gate FAILED after $attempts attempts"
  return 1
}

# ─── Monitor canary metrics ────────────────────────────────────────────────────
monitor_canary() {
  local duration_s="${1:-120}"   # Watch for 2 minutes by default
  local api_url="${ASWAQ_API_URL:-https://api.aswaq.sa}"

  log "Monitoring canary for ${duration_s}s..."

  local start=$(date +%s)
  local errors=0
  local requests=0

  while [[ $(( $(date +%s) - start )) -lt $duration_s ]]; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}/health" --max-time 5 || echo "000")
    requests=$(( requests + 1 ))
    if [[ "$CODE" != "200" ]]; then
      errors=$(( errors + 1 ))
      warn "Canary health check failed: HTTP $CODE ($errors/$requests errors)"
    fi
    sleep 5
  done

  local error_rate=0
  [[ $requests -gt 0 ]] && error_rate=$(( errors * 100 / requests ))

  log "Canary monitoring complete: ${requests} checks, ${errors} errors (${error_rate}% error rate)"

  if [[ $error_rate -gt 5 ]]; then
    error "❌ Canary error rate ${error_rate}% > 5% threshold"
    return 1
  fi

  ok "✅ Canary looks healthy (${error_rate}% error rate)"
  return 0
}

# ─── CANARY DEPLOYMENT ─────────────────────────────────────────────────────────
cmd_canary() {
  step "Canary Deploy — ${CANARY_WEIGHT}% traffic → new version"

  [[ -z "$IMAGE_TAG" ]] && { error "--image-tag required"; exit 1; }

  log "Deploying canary: image=${IMAGE_TAG}, weight=${CANARY_WEIGHT}%"

  # Deploy canary release
  dry "helm upgrade --install ${CANARY_RELEASE} ${HELM_CHART} ..." || \
  helm upgrade --install "$CANARY_RELEASE" "$HELM_CHART" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --set image.tag="$IMAGE_TAG" \
    --set replicaCount=1 \
    --set ingress.canary.enabled=true \
    --set ingress.canary.weight="$CANARY_WEIGHT" \
    --set nameOverride="aswaq-canary" \
    --atomic \
    --timeout 3m

  ok "Canary deployed at ${CANARY_WEIGHT}% weight"

  # Health check on canary
  sleep 10
  health_gate "${ASWAQ_API_URL:-https://staging.api.aswaq.sa}/health" 6 5 || {
    error "Canary health gate failed — auto-rolling back"
    cmd_rollback
    exit 1
  }

  # Monitor canary
  monitor_canary 120 || {
    error "Canary monitoring failed — auto-rolling back"
    cmd_rollback
    exit 1
  }

  echo ""
  ok "✅ Canary is healthy. Run './scripts/canary-deploy.sh promote --env ${ENVIRONMENT}' to promote."
  echo ""
}

# ─── PROMOTE CANARY ────────────────────────────────────────────────────────────
cmd_promote() {
  step "Promoting Canary → Production (100%)"

  [[ -z "$IMAGE_TAG" ]] && {
    # Infer tag from existing canary release
    IMAGE_TAG=$(helm get values "$CANARY_RELEASE" -n "$NAMESPACE" -o json 2>/dev/null | \
                python3 -c "import json,sys; print(json.load(sys.stdin).get('image',{}).get('tag',''))" 2>/dev/null || echo "")
    [[ -z "$IMAGE_TAG" ]] && { error "Cannot determine canary image tag. Pass --image-tag"; exit 1; }
  }

  log "Promoting image: ${IMAGE_TAG}"

  # Upgrade stable release to new image
  dry "helm upgrade ${RELEASE_NAME} ${HELM_CHART} --set image.tag=${IMAGE_TAG} ..." || \
  helm upgrade "$RELEASE_NAME" "$HELM_CHART" \
    --namespace "$NAMESPACE" \
    --set image.tag="$IMAGE_TAG" \
    --set ingress.canary.enabled=false \
    --reuse-values \
    --atomic \
    --timeout 5m

  ok "Stable release upgraded to ${IMAGE_TAG}"

  # Remove canary
  dry "helm uninstall ${CANARY_RELEASE} -n ${NAMESPACE}" || \
  helm uninstall "$CANARY_RELEASE" -n "$NAMESPACE" 2>/dev/null || true

  ok "Canary release removed"

  # Final health gate
  health_gate "${ASWAQ_API_URL:-https://api.aswaq.sa}/health" 6 10

  ok "✅ Promotion complete — ${IMAGE_TAG} is now serving 100% traffic"
}

# ─── ROLLBACK ─────────────────────────────────────────────────────────────────
cmd_rollback() {
  step "⚡ ROLLBACK — Target: < 5 minutes"

  local start_time=$(date +%s)
  warn "Initiating rollback on ${RELEASE_NAME} in ${NAMESPACE}..."

  # Helm rollback to previous revision
  dry "helm rollback ${RELEASE_NAME} 0 --namespace ${NAMESPACE}" || \
  helm rollback "$RELEASE_NAME" 0 --namespace "$NAMESPACE" --timeout "${ROLLBACK_TIMEOUT}s"

  # Remove canary if exists
  helm uninstall "$CANARY_RELEASE" -n "$NAMESPACE" 2>/dev/null || true

  # Wait for pods
  dry "kubectl rollout status deployment/aswaq -n ${NAMESPACE}" || \
  kubectl rollout status "deployment/aswaq" -n "$NAMESPACE" --timeout="${ROLLBACK_TIMEOUT}s"

  local elapsed=$(( $(date +%s) - start_time ))
  ok "Rollback complete in ${elapsed}s"

  # Health gate
  health_gate "${ASWAQ_API_URL:-https://api.aswaq.sa}/health" 6 10

  if [[ $elapsed -gt 300 ]]; then
    warn "⚠️  Rollback took ${elapsed}s — exceeded 5-minute SLO target"
  else
    ok "✅ Rollback within SLO target (${elapsed}s < 300s)"
  fi

  # Notify
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"⚡ Aswaq rollback completed in ${elapsed}s on ${ENVIRONMENT}\"}" > /dev/null || true
  fi
}

# ─── BLUE/GREEN ────────────────────────────────────────────────────────────────
cmd_blue_green() {
  step "Blue/Green Deploy"

  [[ -z "$IMAGE_TAG" ]] && { error "--image-tag required"; exit 1; }

  log "Strategy: Deploy 'green' fully, then switch ingress"

  # Current active slot (blue or green)
  CURRENT_SLOT=$(helm get values "$RELEASE_NAME" -n "$NAMESPACE" -o json 2>/dev/null | \
                 python3 -c "import json,sys; print(json.load(sys.stdin).get('slot','blue'))" 2>/dev/null || echo "blue")
  NEW_SLOT=$( [[ "$CURRENT_SLOT" == "blue" ]] && echo "green" || echo "blue" )

  log "Current slot: ${CURRENT_SLOT} → New slot: ${NEW_SLOT}"

  # Deploy new slot (inactive)
  dry "helm upgrade --install aswaq-${NEW_SLOT} ${HELM_CHART} --set slot=${NEW_SLOT} ..." || \
  helm upgrade --install "aswaq-${NEW_SLOT}" "$HELM_CHART" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --set image.tag="$IMAGE_TAG" \
    --set slot="$NEW_SLOT" \
    --set ingress.enabled=false \
    --atomic \
    --timeout 5m

  ok "${NEW_SLOT} slot deployed"

  # Health gate on new slot
  log "Running health gate on ${NEW_SLOT}..."
  health_gate "${ASWAQ_API_URL:-https://api.aswaq.sa}/health" 6 10

  # Switch ingress to new slot
  log "Switching ingress to ${NEW_SLOT}..."
  dry "kubectl patch ingress aswaq -n ${NAMESPACE} --type=json ..." || \
  kubectl patch ingress aswaq -n "$NAMESPACE" \
    --type=json \
    -p "[{\"op\":\"replace\",\"path\":\"/spec/rules/0/http/paths/0/backend/service/name\",\"value\":\"aswaq-${NEW_SLOT}\"}]"

  ok "Ingress switched to ${NEW_SLOT}"

  # Post-switch health gate
  health_gate "${ASWAQ_API_URL:-https://api.aswaq.sa}/health" 6 10

  # Tear down old slot
  log "Removing old ${CURRENT_SLOT} slot..."
  dry "helm uninstall aswaq-${CURRENT_SLOT} -n ${NAMESPACE}" || \
  helm uninstall "aswaq-${CURRENT_SLOT}" -n "$NAMESPACE" 2>/dev/null || true

  ok "✅ Blue/Green deploy complete. Active slot: ${NEW_SLOT}, image: ${IMAGE_TAG}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}Aswaq Deployment — ${COMMAND} [${ENVIRONMENT}]${NC}"
echo -e "Image: ${IMAGE_TAG:-auto} | Namespace: ${NAMESPACE} | Dry: ${DRY_RUN}"
echo ""

case "$COMMAND" in
  canary)     cmd_canary ;;
  promote)    cmd_promote ;;
  rollback)   cmd_rollback ;;
  blue-green) cmd_blue_green ;;
  help|*)
    echo "Usage: $0 <canary|promote|rollback|blue-green> [--image-tag TAG] [--weight N] [--env staging|production] [--dry-run]"
    echo ""
    echo "  canary      Deploy to 10% traffic, monitor, then promote"
    echo "  promote     Promote canary to 100%"
    echo "  rollback    Rollback to previous version (< 5 min SLO)"
    echo "  blue-green  Full blue/green switch"
    exit 0
    ;;
esac
