#!/usr/bin/env bash
#
# Creates .env from .env.example and generates a random initial admin
# password, so a public deployment never sits on the well-known default.
# Idempotent: if .env already exists it is left completely alone.
#
# Usage:
#   make setup
#   ./scripts/setup-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source scripts/lib.sh

if [[ -f .env ]]; then
  echo "==> .env already exists — leaving it untouched"
  exit 0
fi

cp .env.example .env

PASSWORD="$(random_password 20)"
sed -i "s|^ADMIN_INITIAL_PASSWORD=.*|ADMIN_INITIAL_PASSWORD=${PASSWORD}|" .env

echo "==> Created .env"
echo ""
echo "================================================================"
echo " Initial admin login"
echo "   username: admin"
echo "   password: ${PASSWORD}"
echo "================================================================"
echo ""
echo "Write this down now — it is only used the first time the database is"
echo "created, and is not printed again. Change it after logging in from:"
echo "  پنل مدیریت -> اطلاعات مرکز -> تغییر رمز عبور مدیر"
echo ""
