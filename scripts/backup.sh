#!/usr/bin/env bash
#
# Snapshots the SQLite database to backups/. Everything the system holds —
# members, referrals, plans, coaches, classes, articles, settings and the
# admin password hash — is in that one file, so this is the whole backup.
#
# Uses SQLite's online-backup API via the container, which is safe to run
# while the app is serving traffic; copying the file with cp while a write
# is in flight is not.
#
# Usage:
#   make backup
#   ./scripts/backup.sh
#
# Restore (stop the app first, then swap the file back):
#   docker compose down
#   cp backups/nosrati-YYYYmmdd-HHMMSS.db data/nosrati.db
#   docker compose up -d
set -euo pipefail

cd "$(dirname "$0")/.."

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/nosrati-${STAMP}.db"
mkdir -p backups

if [[ ! -f data/nosrati.db ]]; then
  echo "Error: data/nosrati.db not found — has the app ever been started?" >&2
  exit 1
fi

if docker compose ps --status running --quiet app 2>/dev/null | grep -q .; then
  echo "==> App is running; taking a consistent online backup"
  docker compose exec -T app node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('/app/data/nosrati.db');
    db.exec(\"VACUUM INTO '/app/data/.backup-tmp.db'\");
    db.close();
  "
  mv "data/.backup-tmp.db" "$OUT"
else
  echo "==> App is not running; copying the database file directly"
  cp data/nosrati.db "$OUT"
fi

echo ""
echo "Backup written: ${OUT}  ($(du -h "$OUT" | cut -f1))"
echo ""
echo "Keep these off the server too:"
echo "  scp YOUR_USER@YOUR_SERVER:$(pwd)/${OUT} ."
