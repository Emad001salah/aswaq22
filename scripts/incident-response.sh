#!/usr/bin/env bash
# =============================================================================
# incident-response.sh — Aswaq Incident Response Automation
# =============================================================================
# USAGE:
#   ./scripts/incident-response.sh <SEV1|SEV2|SEV3> <component> [--dry-run]
#
# SEVERITIES:
#   SEV1 — Database Down / Full Outage       → Page on-call immediately
#   SEV2 — Partial Degradation (Redis/Search) → Alert team, investigate
#   SEV3 — Performance Degradation           → Monitor, prepare rollback
#
# COMPONENTS:
#   database | redis | api | k8s | backup | security
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/incident-${TIMESTAMP}.log"
INCIDENT_ID="INC-$(date +%Y%m%d)-$(shuf -i 1000-9999 -n 1)"

# ─── Defaults ─────────────────────────────────────────────────────────────────
SEVERITY="${1:-SEV3}"
COMPONENT="${2:-api}"
DRY_RUN=false
NAMESPACE="aswaq"

[[ "${3:-}" == "--dry-run" ]] && DRY_RUN=true

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN${NC} $*"; }
error(){ echo -e "${RED}[$(date '+%H:%M:%S')] ERROR${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK${NC} $*"; }
step() { echo -e "\n${CYAN}${BOLD}━━━ $* ━━━${NC}"; }
dry()  { [[ "$DRY_RUN" == "true" ]] && warn "[DRY RUN] Would: $*" && return 0; return 1; }

# ── Slack notification ────────────────────────────────────────────────────────
notify_slack() {
  local msg="$1"
  local color="${2:-#FF0000}"

  if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
    warn "SLACK_WEBHOOK_URL not set — skipping notification"
    return 0
  fi

  dry "POST to Slack: $msg" && return 0

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-type: application/json' \
    --data "{
      \"attachments\": [{
        \"color\": \"${color}\",
        \"title\": \"🚨 Aswaq Incident — ${INCIDENT_ID}\",
        \"text\": \"${msg}\",
        \"footer\": \"Incident Response System\",
        \"ts\": $(date +%s)
      }]
    }" > /dev/null

  ok "Slack notified"
}

# ── PagerDuty trigger ─────────────────────────────────────────────────────────
trigger_pagerduty() {
  local summary="$1"

  if [[ -z "${PAGERDUTY_INTEGRATION_KEY:-}" ]]; then
    warn "PAGERDUTY_INTEGRATION_KEY not set — skipping page"
    return 0
  fi

  dry "Trigger PagerDuty: $summary" && return 0

  curl -s -X POST https://events.pagerduty.com/v2/enqueue \
    -H 'Content-type: application/json' \
    --data "{
      \"routing_key\": \"${PAGERDUTY_INTEGRATION_KEY}\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"${summary}\",
        \"severity\": \"critical\",
        \"source\": \"aswaq-incident-response\",
        \"custom_details\": {
          \"incident_id\": \"${INCIDENT_ID}\",
          \"component\": \"${COMPONENT}\",
          \"severity\": \"${SEVERITY}\"
        }
      }
    }" > /dev/null

  ok "PagerDuty paged"
}

# ── Kubernetes diagnostics ────────────────────────────────────────────────────
k8s_diagnostics() {
  step "Kubernetes Diagnostics"

  log "Pod status:"
  kubectl get pods -n "$NAMESPACE" --sort-by='.status.startTime' 2>/dev/null || warn "kubectl not available"

  log "Recent pod events:"
  kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || true

  log "Pod resource usage:"
  kubectl top pods -n "$NAMESPACE" 2>/dev/null || warn "metrics-server not available"

  log "Node status:"
  kubectl get nodes 2>/dev/null || true
}

# ── Database diagnostics ───────────────────────────────────────────────────────
db_diagnostics() {
  step "Database Diagnostics"

  if [[ -z "${DATABASE_URL:-}" ]]; then
    warn "DATABASE_URL not set — fetching from Secrets Manager..."
    if command -v aws &>/dev/null; then
      DATABASE_URL=$(aws secretsmanager get-secret-value \
        --secret-id "aswaq/production" \
        --query SecretString --output text 2>/dev/null | \
        python3 -c "import json,sys; print(json.load(sys.stdin).get('DATABASE_URL',''))" 2>/dev/null || echo "")
    fi
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    warn "Cannot connect to database — DATABASE_URL unavailable"
    return 0
  fi

  log "Testing database connectivity..."
  if psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
    ok "Database is REACHABLE"
    log "Active connections:"
    psql "$DATABASE_URL" -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;" 2>/dev/null || true
    log "Database size:"
    psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null || true
    log "Long-running queries (>30s):"
    psql "$DATABASE_URL" -c "
      SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
      AND state != 'idle';" 2>/dev/null || true
  else
    error "Database is UNREACHABLE"
    return 1
  fi
}

# ── SEV1 — Full Outage ────────────────────────────────────────────────────────
handle_sev1() {
  step "SEV1 RESPONSE — ${COMPONENT} OUTAGE"
  error "🚨 SEVERITY 1 INCIDENT DECLARED"
  error "Incident ID: ${INCIDENT_ID}"
  error "Component:   ${COMPONENT}"
  error "Time:        $(date -u)"

  # 1. Immediate notifications
  notify_slack "🔴 *SEV1 INCIDENT* — ${COMPONENT} is DOWN\nIncident: ${INCIDENT_ID}\nTime: $(date -u)\nOn-call: please acknowledge immediately" "#FF0000"
  trigger_pagerduty "SEV1: Aswaq ${COMPONENT} DOWN — ${INCIDENT_ID}"

  # 2. Collect diagnostics
  k8s_diagnostics 2>/dev/null || true
  [[ "$COMPONENT" == "database" ]] && db_diagnostics || true

  # 3. Component-specific recovery
  case "$COMPONENT" in
    database)
      step "Database Recovery Procedure"
      log "Step 1: Check RDS status..."
      aws rds describe-db-instances \
        --db-instance-identifier "aswaq-production-postgres" \
        --query 'DBInstances[0].DBInstanceStatus' 2>/dev/null || warn "AWS CLI unavailable"

      log "Step 2: Attempt failover if Multi-AZ..."
      if ! dry "aws rds failover-db-cluster"; then
        aws rds failover-db-cluster \
          --db-cluster-identifier "aswaq-production-postgres" 2>/dev/null || \
          warn "Failover not applicable or unavailable"
      fi

      log "Step 3: If failover fails → initiate Disaster Recovery"
      warn "Run: ./scripts/backup-restore.sh disaster-recovery --backup-key <latest>"
      ;;

    api|k8s)
      step "API/K8s Recovery Procedure"
      log "Step 1: Check pod status..."
      kubectl get pods -n "$NAMESPACE" 2>/dev/null || true

      log "Step 2: Attempt rolling restart..."
      dry "kubectl rollout restart deployment/aswaq -n $NAMESPACE" || \
        kubectl rollout restart deployment/aswaq -n "$NAMESPACE"

      log "Step 3: Watch rollout..."
      dry "kubectl rollout status deployment/aswaq -n $NAMESPACE" || \
        kubectl rollout status deployment/aswaq -n "$NAMESPACE" --timeout=120s || {
          error "Rollout failed — initiating Helm rollback"
          dry "helm rollback aswaq 0 -n $NAMESPACE" || \
            helm rollback aswaq 0 -n "$NAMESPACE"
        }
      ;;
  esac

  # 4. Verify recovery
  step "Recovery Verification"
  sleep 15
  API_URL="${ASWAQ_API_URL:-https://api.aswaq.sa}"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" --max-time 10 || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    ok "✅ Service recovered — HTTP 200"
    notify_slack "✅ *RESOLVED* — Aswaq API recovered\nIncident: ${INCIDENT_ID}\nDuration: ~$(( ($(date +%s) - START_TIME) / 60 )) minutes" "#00FF00"
  else
    error "❌ Service still DOWN (HTTP ${HTTP_CODE})"
    error "Manual intervention required"
    notify_slack "❌ *UNRESOLVED* — Auto-recovery failed\nIncident: ${INCIDENT_ID}\nHTTP: ${HTTP_CODE}\nManual intervention required" "#FF0000"
    exit 1
  fi
}

# ── SEV2 — Partial Degradation ────────────────────────────────────────────────
handle_sev2() {
  step "SEV2 RESPONSE — ${COMPONENT} DEGRADED"
  warn "⚠️  SEVERITY 2 INCIDENT"
  log "Incident ID: ${INCIDENT_ID}"
  log "Component:   ${COMPONENT}"

  notify_slack "🟡 *SEV2* — ${COMPONENT} degraded\nIncident: ${INCIDENT_ID}\nInvestigate within 30 minutes" "#FFA500"

  k8s_diagnostics 2>/dev/null || true

  case "$COMPONENT" in
    redis)
      log "Redis diagnostics..."
      kubectl exec -n "$NAMESPACE" \
        "$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')" \
        -- redis-cli -u "${REDIS_URL:-redis://localhost:6379}" INFO server 2>/dev/null || warn "Redis CLI unavailable"
      ;;
    search)
      log "Meilisearch health check..."
      curl -s "${MEILISEARCH_URL:-http://localhost:7700}/health" 2>/dev/null || warn "Meilisearch unreachable"
      ;;
  esac

  log "Monitor the situation. Escalate to SEV1 if not resolved in 30 minutes."
  log "Runbook: https://github.com/aswaq/aswaq/wiki/runbooks/${COMPONENT}"
}

# ── SEV3 — Performance Issue ───────────────────────────────────────────────────
handle_sev3() {
  step "SEV3 RESPONSE — Performance Degradation"
  log "Incident ID: ${INCIDENT_ID}"
  log "Component:   ${COMPONENT}"

  notify_slack "🔵 *SEV3* — Performance degradation detected in ${COMPONENT}\nIncident: ${INCIDENT_ID}" "#0000FF"

  log "Collecting performance data..."
  kubectl top pods -n "$NAMESPACE" 2>/dev/null || true

  log "Recent logs (last 50 lines):"
  kubectl logs -n "$NAMESPACE" \
    "$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')" \
    --tail=50 2>/dev/null || true

  log "SEV3: Monitor for 15 minutes. Escalate to SEV2 if not improving."
}

# ── RCA Template Generator ────────────────────────────────────────────────────
generate_rca() {
  local rca_file="${PROJECT_ROOT}/logs/RCA-${INCIDENT_ID}.md"

  cat > "$rca_file" <<EOF
# RCA — Root Cause Analysis
**Incident ID:** ${INCIDENT_ID}
**Date:** $(date -u '+%Y-%m-%d %H:%M UTC')
**Severity:** ${SEVERITY}
**Component:** ${COMPONENT}
**Reported by:** $(whoami)

## Timeline
| Time | Event |
|------|-------|
| $(date -u '+%H:%M') | Incident detected |
| | Alert triggered |
| | On-call notified |
| | Investigation started |
| | Root cause identified |
| | Fix applied |
| | Service restored |

## Root Cause
<!-- Describe what caused the incident -->

## Contributing Factors
<!-- What made this worse or harder to detect? -->

## Impact
- **Duration:** 
- **Users Affected:** 
- **Requests Failed:** 

## Resolution
<!-- What was done to fix it? -->

## Prevention
<!-- What will prevent this from happening again? -->

| Action | Owner | Due Date |
|--------|-------|----------|
| | | |

## Lessons Learned
<!-- Key takeaways -->

---
*This RCA should be shared with the team within 48 hours of incident resolution.*
EOF

  ok "RCA template generated: ${rca_file}"
}

# ── Main ───────────────────────────────────────────────────────────────────────
START_TIME=$(date +%s)

echo ""
echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║   ASWAQ INCIDENT RESPONSE                        ║${NC}"
echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
log "Incident ID : ${INCIDENT_ID}"
log "Severity    : ${SEVERITY}"
log "Component   : ${COMPONENT}"
log "Dry Run     : ${DRY_RUN}"
log "Log File    : ${LOG_FILE}"
echo ""

generate_rca

case "${SEVERITY}" in
  SEV1) handle_sev1 ;;
  SEV2) handle_sev2 ;;
  SEV3) handle_sev3 ;;
  *)
    error "Unknown severity: ${SEVERITY}. Use SEV1 | SEV2 | SEV3"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}${BOLD}Incident response complete — ${INCIDENT_ID}${NC}"
echo -e "Log: ${LOG_FILE}"
echo ""
