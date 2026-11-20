#!/bin/sh
# Daily PostgreSQL backup loop used by the "backup" service in docker-compose.yml.
# Writes /backups/atg-YYYY-MM-DD.dump at 02:00 and keeps the last 30 days.
set -u
while true; do
  if [ "$(date +%H%M)" = "0200" ]; then
    pg_dump -h db -U atg -d atg -Fc -f "/backups/atg-$(date +%F).dump"
    find /backups -name 'atg-*.dump' -mtime +30 -delete
    sleep 60
  fi
  sleep 30
done
