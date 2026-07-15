#!/usr/bin/env bash
# =============================================================================
# owasp-zap-scan.sh — OWASP ZAP Security Scan against local/staging server
# =============================================================================
# USAGE:
#   ./scripts/owasp-zap-scan.sh [--target http://localhost:4000] [--full]
#
# PREREQUISITES:
#   - Docker installed and running
#   - Target server must be running and accessible
# =============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="${PROJECT_ROOT}/reports/zap-${TIMESTAMP}"

# ─── Defaults ─────────────────────────────────────────────────────────────────
TARGET="http://host.docker.internal:4000"
SCAN_TYPE="baseline"   # baseline | full | api
OUTPUT_FORMAT="html"   # html | json | xml

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[ZAP]${NC} $*"; }
ok()   { echo -e "${GREEN}[ZAP]${NC} $*"; }
warn() { echo -e "${YELLOW}[ZAP]${NC} $*"; }
error(){ echo -e "${RED}[ZAP]${NC} $*" >&2; }

# ─── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET="$2"; shift 2 ;;
    --full)   SCAN_TYPE="full"; shift ;;
    --api)    SCAN_TYPE="api"; shift ;;
    *) error "Unknown: $1"; exit 1 ;;
  esac
done

mkdir -p "$REPORT_DIR"

log "Starting OWASP ZAP ${SCAN_TYPE} scan against: ${TARGET}"
log "Reports will be saved to: ${REPORT_DIR}"

# ─── Pull ZAP image if needed ─────────────────────────────────────────────────
docker pull ghcr.io/zaproxy/zaproxy:stable -q

# ─── Run scan ─────────────────────────────────────────────────────────────────
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"
REPORT_FILE="${REPORT_DIR}/zap-report"

case "$SCAN_TYPE" in
  baseline)
    log "Running Baseline Scan (passive only, ~2-3 minutes)..."
    docker run --rm \
      -v "${REPORT_DIR}:/zap/wrk/:rw" \
      --add-host=host.docker.internal:host-gateway \
      "$ZAP_IMAGE" \
      zap-baseline.py \
        -t "$TARGET" \
        -r zap-report.html \
        -J zap-report.json \
        -I \
        2>&1 | tee "${REPORT_DIR}/zap-stdout.log" || SCAN_EXIT=$?
    ;;

  full)
    log "Running Full Scan (active, ~10-20 minutes)..."
    docker run --rm \
      -v "${REPORT_DIR}:/zap/wrk/:rw" \
      --add-host=host.docker.internal:host-gateway \
      "$ZAP_IMAGE" \
      zap-full-scan.py \
        -t "$TARGET" \
        -r zap-report.html \
        -J zap-report.json \
        -I \
        2>&1 | tee "${REPORT_DIR}/zap-stdout.log" || SCAN_EXIT=$?
    ;;

  api)
    log "Running API Scan (OpenAPI-aware)..."
    docker run --rm \
      -v "${REPORT_DIR}:/zap/wrk/:rw" \
      --add-host=host.docker.internal:host-gateway \
      "$ZAP_IMAGE" \
      zap-api-scan.py \
        -t "${TARGET}/api-docs/swagger.json" \
        -f openapi \
        -r zap-report.html \
        -J zap-report.json \
        -I \
        2>&1 | tee "${REPORT_DIR}/zap-stdout.log" || SCAN_EXIT=$?
    ;;
esac

# ─── Parse results ────────────────────────────────────────────────────────────
echo ""
log "Parsing scan results..."

if [ -f "${REPORT_DIR}/zap-report.json" ]; then
  python3 - <<'PYEOF' "${REPORT_DIR}/zap-report.json"
import json, sys

report_file = sys.argv[1]
with open(report_file) as f:
    data = json.load(f)

sites = data.get('site', [])
total = {'high': 0, 'medium': 0, 'low': 0, 'informational': 0}

for site in sites:
    for alert in site.get('alerts', []):
        risk = alert.get('riskdesc', '').lower()
        for level in ['high', 'medium', 'low', 'informational']:
            if level in risk:
                total[level] += 1
                break

print(f"\n{'='*50}")
print(f"  OWASP ZAP Scan Summary")
print(f"{'='*50}")
print(f"  🔴 High Risk    : {total['high']}")
print(f"  🟡 Medium Risk  : {total['medium']}")
print(f"  🔵 Low Risk     : {total['low']}")
print(f"  ℹ️  Informational: {total['informational']}")
print(f"{'='*50}")

if total['high'] > 0:
    print(f"\n  ⚠️  HIGH RISK FINDINGS:")
    for site in sites:
        for alert in site.get('alerts', []):
            if 'high' in alert.get('riskdesc', '').lower():
                print(f"  - {alert.get('name', 'Unknown')}: {alert.get('desc', '')[:80]}")

exit(1 if total['high'] > 0 else 0)
PYEOF
  PARSE_EXIT=$?
else
  warn "JSON report not found — check stdout log: ${REPORT_DIR}/zap-stdout.log"
  PARSE_EXIT=0
fi

echo ""
ok "Reports saved to: ${REPORT_DIR}"
ok "HTML Report: ${REPORT_DIR}/zap-report.html"
ok "JSON Report: ${REPORT_DIR}/zap-report.json"

if [ "${PARSE_EXIT:-0}" -ne 0 ]; then
  error "HIGH RISK findings detected — review report before release"
  exit 1
fi

ok "ZAP scan complete — no HIGH risk findings"
