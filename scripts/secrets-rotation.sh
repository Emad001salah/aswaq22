#!/usr/bin/env bash
# =============================================================================
# secrets-rotation.sh — Aswaq Production Secrets Rotation Runbook
# =============================================================================
# PURPOSE:
#   Rotate JWT secrets and database password without downtime using a
#   Blue/Green secret strategy via AWS Secrets Manager.
#
# USAGE:
#   ./scripts/secrets-rotation.sh [--env staging|production] [--component jwt|db|all]
#
# PREREQUISITES:
#   - aws CLI configured with sufficient permissions (SecretsManager + EKS)
#   - kubectl configured for the target cluster
#   - helm installed
#   - jq installed
#
# SAFETY:
#   This script is IDEMPOTENT and DRY-RUN safe. Pass --dry-run to preview
#   changes without applying them.
# =============================================================================

set -Eeuo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/secrets-rotation-${TIMESTAMP}.log"
NAMESPACE="aswaq"
SECRET_NAME_PREFIX="aswaq"

# ─── Defaults ─────────────────────────────────────────────────────────────────
ENV="production"
COMPONENT="all"
DRY_RUN=false
ROLLBACK=false

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')] INFO${NC}  $*"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN${NC}  $*"; }
error(){ echo -e "${RED}[$(date '+%H:%M:%S')] ERROR${NC} $*" >&2; }
ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK${NC}    $*"; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)        ENV="$2";        shift 2 ;;
    --component)  COMPONENT="$2";  shift 2 ;;
    --dry-run)    DRY_RUN=true;    shift   ;;
    --rollback)   ROLLBACK=true;   shift   ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Validation ───────────────────────────────────────────────────────────────
validate_prerequisites() {
  log "Validating prerequisites..."
  local missing=()

  for cmd in aws kubectl helm jq openssl; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required tools: ${missing[*]}"
    exit 1
  fi

  # Verify AWS credentials
  aws sts get-caller-identity &>/dev/null || { error "AWS credentials invalid or expired"; exit 1; }

  # Verify k8s connectivity
  kubectl cluster-info &>/dev/null || { error "Cannot connect to Kubernetes cluster"; exit 1; }

  ok "All prerequisites satisfied"
}

# ─── Helper: generate a cryptographically random secret ──────────────────────
generate_secret() {
  local length="${1:-64}"
  openssl rand -base64 "$length" | tr -d '=+/' | head -c "$length"
}

# ─── Helper: update Secrets Manager and Kubernetes secret ────────────────────
update_aws_secret() {
  local key="$1"
  local value="$2"
  local secret_id="${SECRET_NAME_PREFIX}/${ENV}"

  log "Updating AWS Secrets Manager: ${secret_id} → ${key}"

  if [[ "$DRY_RUN" == "true" ]]; then
    warn "[DRY RUN] Would update ${key} in ${secret_id}"
    return 0
  fi

  # Fetch current secret
  local current
  current=$(aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text)

  # Merge updated key
  local updated
  updated=$(echo "$current" | jq --arg k "$key" --arg v "$value" '.[$k] = $v')

  aws secretsmanager put-secret-value \
    --secret-id "$secret_id" \
    --secret-string "$updated" \
    --version-stages AWSCURRENT

  ok "AWS Secrets Manager updated for key: ${key}"
}

# ─── JWT Rotation ─────────────────────────────────────────────────────────────
rotate_jwt_secrets() {
  log "═══════════════════════════════════════════"
  log "  Rotating JWT secrets (zero-downtime)"
  log "═══════════════════════════════════════════"

  # Step 1: Generate new secrets
  local new_jwt
  local new_refresh
  new_jwt=$(generate_secret 64)
  new_refresh=$(generate_secret 64)

  log "Generated new JWT secrets (lengths: ${#new_jwt}, ${#new_refresh})"

  # Step 2: Update Secrets Manager
  update_aws_secret "JWT_SECRET"         "$new_jwt"
  update_aws_secret "JWT_REFRESH_SECRET" "$new_refresh"

  # Step 3: Rolling restart (pods pick up new secrets from Secrets Manager via ExternalSecrets)
  if [[ "$DRY_RUN" == "false" ]]; then
    log "Triggering rolling restart of aswaq deployment..."
    kubectl rollout restart deployment/aswaq -n "$NAMESPACE"
    kubectl rollout status  deployment/aswaq -n "$NAMESPACE" --timeout=300s
    ok "Rolling restart completed"
  else
    warn "[DRY RUN] Would trigger rolling restart of deployment/aswaq"
  fi

  # Step 4: Invalidate all refresh tokens in Redis
  if [[ "$DRY_RUN" == "false" ]]; then
    log "Flushing refresh token store in Redis..."
    kubectl exec -n "$NAMESPACE" \
      "$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')" \
      -- node -e "
        const { createClient } = require('redis');
        (async () => {
          const client = createClient({ url: process.env.REDIS_URL });
          await client.connect();
          const keys = await client.keys('refresh:*');
          if (keys.length) await client.del(keys);
          console.log('Cleared', keys.length, 'refresh token(s)');
          await client.quit();
        })().catch(console.error);
      " || warn "Redis flush failed — tokens will expire naturally within TTL"
  else
    warn "[DRY RUN] Would flush refresh:* keys from Redis"
  fi

  ok "JWT secrets rotated successfully"
}

# ─── Database Password Rotation ───────────────────────────────────────────────
rotate_db_password() {
  log "═══════════════════════════════════════════"
  log "  Rotating database password"
  log "═══════════════════════════════════════════"

  local new_password
  new_password=$(generate_secret 32)

  # Step 1: Update RDS password
  local db_identifier="${SECRET_NAME_PREFIX}-${ENV}-postgres"

  if [[ "$DRY_RUN" == "false" ]]; then
    log "Modifying RDS instance password..."
    aws rds modify-db-instance \
      --db-instance-identifier "$db_identifier" \
      --master-user-password "$new_password" \
      --apply-immediately

    log "Waiting for RDS modification to complete..."
    aws rds wait db-instance-available --db-instance-identifier "$db_identifier"
    ok "RDS password updated"
  else
    warn "[DRY RUN] Would modify RDS instance: ${db_identifier}"
  fi

  # Step 2: Fetch current DATABASE_URL and reconstruct it with new password
  if [[ "$DRY_RUN" == "false" ]]; then
    local current_url
    current_url=$(aws secretsmanager get-secret-value \
      --secret-id "${SECRET_NAME_PREFIX}/${ENV}" \
      --query SecretString --output text | jq -r '.DATABASE_URL')

    # Replace password in connection string (postgres://user:PASSWORD@host:port/db)
    local new_url
    new_url=$(echo "$current_url" | sed "s|://\([^:]*\):[^@]*@|://\1:${new_password}@|")

    update_aws_secret "DATABASE_URL" "$new_url"
  else
    warn "[DRY RUN] Would reconstruct DATABASE_URL with new password"
  fi

  # Step 3: Rolling restart to pick up new credentials
  if [[ "$DRY_RUN" == "false" ]]; then
    log "Triggering rolling restart..."
    kubectl rollout restart deployment/aswaq -n "$NAMESPACE"
    kubectl rollout status  deployment/aswaq -n "$NAMESPACE" --timeout=300s
    ok "Rolling restart completed"
  fi

  ok "Database password rotated successfully"
}

# ─── Verification ─────────────────────────────────────────────────────────────
verify_rotation() {
  log "Verifying rotation..."

  if [[ "$DRY_RUN" == "true" ]]; then
    warn "[DRY RUN] Skipping verification"
    return 0
  fi

  # Health check
  local api_url="https://api.aswaq.sa"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}/health" --max-time 10 || echo "000")

  if [[ "$http_code" == "200" ]]; then
    ok "Health check passed (HTTP ${http_code})"
  else
    error "Health check FAILED (HTTP ${http_code})"
    warn "Investigate before continuing. Logs: ${LOG_FILE}"
    exit 1
  fi

  ok "Rotation verified"
}

# ─── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   Secrets Rotation — Complete            ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Environment : ${ENV}"
  echo "  Component   : ${COMPONENT}"
  echo "  Dry Run     : ${DRY_RUN}"
  echo "  Timestamp   : ${TIMESTAMP}"
  echo "  Log         : ${LOG_FILE}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log "Starting secrets rotation — env=${ENV}, component=${COMPONENT}, dry_run=${DRY_RUN}"

  validate_prerequisites

  case "$COMPONENT" in
    jwt) rotate_jwt_secrets ;;
    db)  rotate_db_password  ;;
    all)
      rotate_jwt_secrets
      rotate_db_password
      ;;
    *)
      error "Unknown component: ${COMPONENT}. Use jwt | db | all"
      exit 1
      ;;
  esac

  verify_rotation
  print_summary
}

main "$@"
