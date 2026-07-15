#!/bin/bash
# scripts/vps-backup.sh
# Backup script for Aswaq Database and Disk Monitor on VPS Staging
# Recommended to run via cron daily: 0 3 * * * /path/to/vps-backup.sh

set -e

# Config
BACKUP_DIR="/var/backups/aswaq"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_CONTAINER="aswaq_postgres"
DB_USER="aswaq"
DB_NAME="aswaq_db"
RETENTION_DAYS=7
MAX_DISK_USAGE=85

echo "Starting Aswaq VPS Backup Protocol at $DATE"

mkdir -p "$BACKUP_DIR"

# 1. Database Backup (pg_dump)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"
echo "Taking PostgreSQL dump from container: $DB_CONTAINER..."
docker exec -t $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"

echo "Backup saved successfully: $BACKUP_FILE"

# 2. Disk Space Monitoring
echo "Checking disk space..."
CURRENT_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$CURRENT_USAGE" -ge "$MAX_DISK_USAGE" ]; then
    echo "🚨 WARNING: Disk usage is critically high at ${CURRENT_USAGE}%!"
    echo "Running Docker Cleanup to free space..."
    docker system prune -af --volumes
    
    # Check again
    NEW_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "Disk usage after cleanup: ${NEW_USAGE}%"
    
    if [ "$NEW_USAGE" -ge "$MAX_DISK_USAGE" ]; then
        echo "🚨 CRITICAL: Disk usage is still above threshold after cleanup. Manual intervention required."
        # In a real environment, send a Slack/Discord/Email alert here.
    fi
else
    echo "✅ Disk usage is healthy: ${CURRENT_USAGE}%"
fi

# 3. Cleanup Old Backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 4. (Optional) Sync to S3
# If aws-cli is configured on the VPS, you can uncomment this:
# aws s3 sync $BACKUP_DIR s3://aswaq-staging-backups/ --delete

echo "Backup Protocol Completed!"
