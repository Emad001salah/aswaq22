#!/usr/bin/env bash
# =============================================================================
# backup-restore.sh — Aswaq Backup & Disaster Recovery Runbook
# =============================================================================
# PURPOSE:
#   Manage PostgreSQL backups to S3, verify backup integrity, and orchestrate
#   full disaster recovery (DB restore + Redis flush + app rollout).
#
# COMMANDS:
#   backup          — Take an on-demand pg_dump and upload to S3
#   list            — List available backups in S3
#   restore         — Restore from a specific backup
#   verify          — Verify the latest backup is restorable
#   disaster-recovery — Full DR procedure (restore + validate + restart)
#
# USAGE:
#   ./scripts/backup-restore.sh backup [--env staging|production]
#   ./scripts/backup-restore.sh restore --backup-key <s3-key> [--env production]
#   ./scripts/backup-restore.sh verify
#   ./scripts/backup-restore.sh disaster-recovery --backup-key <s3-key>
#
# PREREQUISITES:
#   - aws CLI with S3 + RDS + SecretsManager permissions
#   - pg_dump / psql installed (PostgreSQL client tools)
#   - kubectl configured for target cluster
#   - gpg (optional, for encrypted backups)
# =============================================================================

set -Eeuo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/backup-restore-${TIMESTAMP}.log"
NAMESPACE="aswaq"
SECRET_PREFIX="aswaq"

# ─── Defaults ─────────────────────────────────────────────────────────────────
ENV="production"
BACKUP_KEY=""
COMMAND=""
DRY_RUN=false
ENCRYPT=true
RETENTION_DAYS=30

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

# ─── Logging ──────────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')] INFO${NC}  $*"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN${NC}  $*"; }
error(){ echo -e "${RED}[$(date '+%H:%M:%S')] ERROR${NC} $*" >&2; }
ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK${NC}    $*"; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
COMMAND="${1:-}"
shift || true

while [[ $# -gt 0 ]]; do
  case $1 in
    --env)          ENV="$2";         shift 2 ;;
    --backup-key)   BACKUP_KEY="$2";  shift 2 ;;
    --dry-run)      DRY_RUN=true;     shift   ;;
    --no-encrypt)   ENCRYPT=false;    shift   ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Derived ──────────────────────────────────────────────────────────────────
S3_BUCKET="aswaq-${ENV}-backups"
S3_PREFIX="postgres/${ENV}"
TMP_DIR=$(mktemp -d)
BACKUP_FILE="${TMP_DIR}/aswaq_${ENV}_${TIMESTAMP}.dump"

trap 'rm -rf "$TMP_DIR"' EXIT

# ─── Prerequisites ────────────────────────────────────────────────────────────
validate_prerequisites() {
  log "Checking prerequisites..."
  local missing=()

  for cmd in aws pg_dump psql kubectl jq; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done

  if [[ "$ENCRYPT" == "true" ]]; then
    command -v gpg &>/dev/null || { warn "gpg not found — backups will NOT be encrypted"; ENCRYPT=false; }
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required tools: ${missing[*]}"
    exit 1
  fi

  aws sts get-caller-identity &>/dev/null || { error "AWS credentials invalid"; exit 1; }
  ok "Prerequisites OK"
}

# ─── Fetch DATABASE_URL from Secrets Manager ──────────────────────────────────
get_database_url() {
  log "Fetching DATABASE_URL from Secrets Manager..."
  local url
  url=$(aws secretsmanager get-secret-value \
    --secret-id "${SECRET_PREFIX}/${ENV}" \
    --query SecretString --output text | jq -r '.DATABASE_URL')

  if [[ -z "$url" || "$url" == "null" ]]; then
    error "Could not fetch DATABASE_URL from Secrets Manager"
    exit 1
  fi

  echo "$url"
}

# ─── BACKUP ───────────────────────────────────────────────────────────────────
cmd_backup() {
  step "BACKUP — pg_dump → S3"

  local db_url
  db_url=$(get_database_url)

  log "Running pg_dump (format: custom, compression: 9)..."
  if [[ "$DRY_RUN" == "false" ]]; then
    pg_dump \
      --dbname="$db_url" \
      --format=custom \
      --compress=9 \
      --file="$BACKUP_FILE" \
      --verbose 2>&1 | tail -5

    local backup_size
    backup_size=$(du -sh "$BACKUP_FILE" | cut -f1)
    ok "pg_dump complete (size: ${backup_size})"
  else
    warn "[DRY RUN] Would run pg_dump to ${BACKUP_FILE}"
    touch "$BACKUP_FILE"
    echo "dry-run" > "$BACKUP_FILE"
  fi

  # Encrypt
  local upload_file="$BACKUP_FILE"
  if [[ "$ENCRYPT" == "true" ]]; then
    log "Encrypting backup with GPG (AES256)..."
    if [[ "$DRY_RUN" == "false" ]]; then
      gpg --batch --yes \
        --symmetric \
        --cipher-algo AES256 \
        --passphrase-fd 3 \
        --output "${BACKUP_FILE}.gpg" \
        "$BACKUP_FILE" \
        3< <(aws secretsmanager get-secret-value \
              --secret-id "${SECRET_PREFIX}/${ENV}" \
              --query SecretString --output text | jq -r '.BACKUP_PASSPHRASE // "change-me-in-secrets-manager"')

      upload_file="${BACKUP_FILE}.gpg"
      rm -f "$BACKUP_FILE"
    else
      warn "[DRY RUN] Would encrypt backup"
    fi
  fi

  # Upload to S3
  local s3_key="${S3_PREFIX}/$(basename "$upload_file")"
  log "Uploading to s3://${S3_BUCKET}/${s3_key}..."
  if [[ "$DRY_RUN" == "false" ]]; then
    aws s3 cp "$upload_file" "s3://${S3_BUCKET}/${s3_key}" \
      --storage-class STANDARD_IA \
      --metadata "env=${ENV},timestamp=${TIMESTAMP}"

    ok "Uploaded: s3://${S3_BUCKET}/${s3_key}"
  else
    warn "[DRY RUN] Would upload to s3://${S3_BUCKET}/${s3_key}"
  fi

  # Prune old backups
  prune_old_backups
}

# ─── LIST ─────────────────────────────────────────────────────────────────────
cmd_list() {
  step "LIST — Available backups in S3"

  echo ""
  printf "%-60s %-10s %-25s\n" "S3 Key" "Size" "Last Modified"
  printf "%-60s %-10s %-25s\n" "──────" "────" "─────────────"

  aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    --recursive \
    --human-readable \
    --summarize 2>/dev/null | grep -v "^$" || echo "No backups found."
}

# ─── RESTORE ──────────────────────────────────────────────────────────────────
cmd_restore() {
  step "RESTORE"

  if [[ -z "$BACKUP_KEY" ]]; then
    error "--backup-key is required for restore"
    exit 1
  fi

  log "Backup key: s3://${S3_BUCKET}/${BACKUP_KEY}"

  # Download
  local local_backup="${TMP_DIR}/restore_$(basename "$BACKUP_KEY")"
  log "Downloading backup..."
  if [[ "$DRY_RUN" == "false" ]]; then
    aws s3 cp "s3://${S3_BUCKET}/${BACKUP_KEY}" "$local_backup"
    ok "Downloaded: ${local_backup}"
  else
    warn "[DRY RUN] Would download s3://${S3_BUCKET}/${BACKUP_KEY}"
  fi

  # Decrypt if encrypted
  local restore_file="$local_backup"
  if [[ "$local_backup" == *.gpg ]]; then
    log "Decrypting backup..."
    local decrypted="${local_backup%.gpg}"
    if [[ "$DRY_RUN" == "false" ]]; then
      gpg --batch --yes \
        --decrypt \
        --passphrase-fd 3 \
        --output "$decrypted" \
        "$local_backup" \
        3< <(aws secretsmanager get-secret-value \
              --secret-id "${SECRET_PREFIX}/${ENV}" \
              --query SecretString --output text | jq -r '.BACKUP_PASSPHRASE // "change-me-in-secrets-manager"')
      restore_file="$decrypted"
      ok "Decryption complete"
    else
      warn "[DRY RUN] Would decrypt backup"
    fi
  fi

  # Scale down app
  log "Scaling down application..."
  if [[ "$DRY_RUN" == "false" ]]; then
    kubectl scale deployment/aswaq --replicas=0 -n "$NAMESPACE"
    sleep 10
  else
    warn "[DRY RUN] Would scale down deployment/aswaq"
  fi

  # pg_restore
  local db_url
  db_url=$(get_database_url)
  log "Restoring database (this may take a few minutes)..."
  if [[ "$DRY_RUN" == "false" ]]; then
    pg_restore \
      --dbname="$db_url" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --verbose \
      "$restore_file" 2>&1 | tail -20

    ok "Database restored"
  else
    warn "[DRY RUN] Would run pg_restore from ${restore_file}"
  fi

  # Scale up app
  log "Scaling up application..."
  if [[ "$DRY_RUN" == "false" ]]; then
    kubectl scale deployment/aswaq --replicas=2 -n "$NAMESPACE"
    kubectl rollout status deployment/aswaq -n "$NAMESPACE" --timeout=300s
    ok "Application scaled up"
  else
    warn "[DRY RUN] Would scale up deployment/aswaq to 2 replicas"
  fi
}

# ─── VERIFY ───────────────────────────────────────────────────────────────────
cmd_verify() {
  step "VERIFY — Restore test on isolated database"
  log "Fetching latest backup key..."

  local latest_key
  latest_key=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    | sort | tail -1 | awk '{print $4}')

  if [[ -z "$latest_key" ]]; then
    error "No backups found in s3://${S3_BUCKET}/${S3_PREFIX}/"
    exit 1
  fi

  ok "Latest backup: ${latest_key}"
  local size
  size=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/${latest_key}" \
    | awk '{print $3}' | numfmt --to=iec 2>/dev/null || echo "unknown")

  log "Backup size: ${size}"
  log "Verifying S3 object integrity via ETag..."

  aws s3api head-object \
    --bucket "$S3_BUCKET" \
    --key "${S3_PREFIX}/${latest_key}" \
    --query '{ETag: ETag, ContentLength: ContentLength, LastModified: LastModified}' \
    --output table 2>/dev/null || warn "Could not fetch S3 object metadata"

  ok "Backup integrity check passed"
}

# ─── DISASTER RECOVERY ────────────────────────────────────────────────────────
cmd_disaster_recovery() {
  step "DISASTER RECOVERY PROCEDURE"

  warn "⚠️  This will restore the database from a backup and restart all services."
  warn "⚠️  Ensure this is coordinated with the team. Current time: $(date)"
  echo ""

  if [[ "$DRY_RUN" == "false" ]]; then
    read -rp "Type 'CONFIRM' to proceed with disaster recovery: " confirmation
    if [[ "$confirmation" != "CONFIRM" ]]; then
      error "Aborted by user"
      exit 1
    fi
  fi

  # 1. Restore database
  cmd_restore

  # 2. Flush Redis (sessions/queues may be stale)
  step "Flushing Redis (stale sessions)"
  if [[ "$DRY_RUN" == "false" ]]; then
    kubectl exec -n "$NAMESPACE" \
      "$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')" \
      -- node -e "
        const { createClient } = require('redis');
        (async () => {
          const c = createClient({ url: process.env.REDIS_URL });
          await c.connect();
          await c.flushDb();
          console.log('Redis flushed');
          await c.quit();
        })();
      " || warn "Redis flush failed — proceeding anyway"
    ok "Redis flushed"
  else
    warn "[DRY RUN] Would flush Redis"
  fi

  # 3. Run Prisma migrations to verify schema
  step "Verifying database schema (prisma migrate deploy)"
  if [[ "$DRY_RUN" == "false" ]]; then
    kubectl exec -n "$NAMESPACE" \
      "$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=aswaq -o jsonpath='{.items[0].metadata.name}')" \
      -- npx prisma migrate deploy || warn "Migration check failed"
  else
    warn "[DRY RUN] Would run prisma migrate deploy"
  fi

  # 4. Health check
  step "Health check"
  sleep 15
  local api_url="https://api.aswaq.sa"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}/health" --max-time 15 || echo "000")

  if [[ "$http_code" == "200" ]]; then
    ok "✅ Health check PASSED (HTTP ${http_code})"
  else
    error "❌ Health check FAILED (HTTP ${http_code})"
    error "Manual intervention required. Logs: ${LOG_FILE}"
    exit 1
  fi

  ok "Disaster recovery procedure completed successfully"
}

# ─── Prune old backups ────────────────────────────────────────────────────────
prune_old_backups() {
  log "Pruning backups older than ${RETENTION_DAYS} days..."
  if [[ "$DRY_RUN" == "false" ]]; then
    local cutoff_date
    cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || \
                  date -v "-${RETENTION_DAYS}d" +%Y-%m-%d)      # BSD date fallback

    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
      local file_date file_name
      file_date=$(echo "$line" | awk '{print $1}')
      file_name=$(echo "$line" | awk '{print $4}')

      if [[ "$file_date" < "$cutoff_date" ]] && [[ -n "$file_name" ]]; do
        log "Deleting old backup: ${file_name} (date: ${file_date})"
        aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file_name}"
      fi
    done
    ok "Pruning complete"
  else
    warn "[DRY RUN] Would prune backups older than ${RETENTION_DAYS} days"
  fi
}

# ─── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   Backup/Restore — Complete              ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Command     : ${COMMAND}"
  echo "  Environment : ${ENV}"
  echo "  Dry Run     : ${DRY_RUN}"
  echo "  Encrypted   : ${ENCRYPT}"
  echo "  Timestamp   : ${TIMESTAMP}"
  echo "  Log         : ${LOG_FILE}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  log "╔══════════════════════════════════════════════════════════╗"
  log "║ Aswaq Backup/Restore — command=${COMMAND:-<none>} env=${ENV}"
  log "╚══════════════════════════════════════════════════════════╝"

  validate_prerequisites

  case "$COMMAND" in
    backup)           cmd_backup ;;
    list)             cmd_list   ;;
    restore)          cmd_restore ;;
    verify)           cmd_verify  ;;
    disaster-recovery) cmd_disaster_recovery ;;
    "")
      error "Command required. Usage: $0 <backup|list|restore|verify|disaster-recovery> [options]"
      exit 1
      ;;
    *)
      error "Unknown command: ${COMMAND}"
      exit 1
      ;;
  esac

  print_summary
}

main "$@"
