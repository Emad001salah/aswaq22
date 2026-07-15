# GitHub Repository Configuration Guide
# ─────────────────────────────────────────────────────────────────────────────
# Configure the following in your GitHub repository BEFORE running any workflow.
# Go to: Settings → Secrets and variables → Actions
# ─────────────────────────────────────────────────────────────────────────────

## ═══════════════════════════════════════════
## REQUIRED SECRETS (Settings → Secrets)
## ═══════════════════════════════════════════

# AWS Credentials — Staging
AWS_ACCESS_KEY_ID_STAGING       = <IAM key with EKS+RDS+ElastiCache+S3+ECR access on staging>
AWS_SECRET_ACCESS_KEY_STAGING   = <corresponding secret key>

# AWS Credentials — Production
AWS_ACCESS_KEY_ID_PROD          = <IAM key with EKS+RDS+ElastiCache+S3+ECR access on production>
AWS_SECRET_ACCESS_KEY_PROD      = <corresponding secret key>

# Snyk (optional — set SNYK_ENABLED variable to 'true' to activate)
SNYK_TOKEN                      = <from https://app.snyk.io/account>

# Slack (optional — leave empty to skip Slack notifications)
SLACK_WEBHOOK_URL               = <incoming webhook URL from Slack app>


## ═══════════════════════════════════════════
## REQUIRED VARIABLES (Settings → Variables)
## ═══════════════════════════════════════════

SNYK_ENABLED = true   # Set to 'false' to skip Snyk scans


## ═══════════════════════════════════════════
## ENVIRONMENTS (Settings → Environments)
## ═══════════════════════════════════════════
#
# Create two environments: "staging" and "production"
#
# staging:
#   - No required reviewers (auto-approve)
#   - Deployment branch: main, develop
#
# production:
#   - Required reviewers: add your tech lead / yourself
#   - Wait timer: 0 minutes (or 5 for safety)
#   - Deployment branch: main only
#
# This ensures:
#   - Staging deployments run automatically on push to main
#   - Production deployments require a manual approval click
