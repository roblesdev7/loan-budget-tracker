#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy completo a Hostinger Shared Hosting via SSH + rsync
#
# USO:
#   1. Copia deploy.config.example → deploy.config y edita tus valores
#   2. chmod +x deploy.sh
#   3. ./deploy.sh
#
# ESTRUCTURA EN SERVIDOR:
#   public_html/              ← portal (home page del dominio)
#   public_html/finance/      ← app Loan & Budget (React SPA)
#   public_html/api/          ← backend PHP
#
# REQUISITOS LOCALES: rsync, ssh, node/npm
# =============================================================================
set -euo pipefail

CONFIG_FILE="$(dirname "$0")/deploy.config"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Falta deploy.config — copia deploy.config.example y edítalo."
  exit 1
fi
# shellcheck source=deploy.config
source "$CONFIG_FILE"

: "${SSH_ALIAS:?Falta SSH_ALIAS en deploy.config}"
: "${REMOTE_BACKEND:?Falta REMOTE_BACKEND en deploy.config}"
: "${REMOTE_FRONTEND:?Falta REMOTE_FRONTEND en deploy.config}"
: "${REMOTE_FINANCE:?Falta REMOTE_FINANCE en deploy.config}"

RSYNC_SSH="ssh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
PORTAL_DIR="$SCRIPT_DIR/portal"

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│         Loan & Budget — Deploy Script        │"
echo "│  Alias SSH: ${SSH_ALIAS}                     │"
echo "└─────────────────────────────────────────────┘"
echo ""

# ── 1. Build del frontend ─────────────────────────────────────────────────────
echo "▶ [1/5] Build del frontend React (base: /finance/)..."
cd "$FRONTEND_DIR"
npm install --silent
VITE_API_URL="${API_PUBLIC_URL}" npm run build
echo "   ✓ Build completado → frontend/dist/"

# ── 2. Deploy del backend PHP ─────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Subiendo backend PHP..."
rsync -az --delete -e "${RSYNC_SSH}" \
  --exclude='.env' \
  --exclude='*.log' \
  "$BACKEND_DIR/" \
  "${SSH_ALIAS}:${REMOTE_BACKEND}/"
echo "   ✓ Backend sincronizado en ${REMOTE_BACKEND}"

# ── 3. Deploy del portal (home page del dominio) ──────────────────────────────
echo ""
echo "▶ [3/5] Subiendo portal (home page)..."
rsync -az -e "${RSYNC_SSH}" \
  "$PORTAL_DIR/" \
  "${SSH_ALIAS}:${REMOTE_FRONTEND}/"
echo "   ✓ Portal sincronizado en ${REMOTE_FRONTEND}"

# ── 4. Deploy del frontend finance app ────────────────────────────────────────
echo ""
echo "▶ [4/5] Subiendo app finance..."
rsync -az --delete -e "${RSYNC_SSH}" \
  "$FRONTEND_DIR/dist/" \
  "${SSH_ALIAS}:${REMOTE_FINANCE}/"
echo "   ✓ Finance app sincronizada en ${REMOTE_FINANCE}"

# ── 5. Verificar .env en servidor ────────────────────────────────────────────
echo ""
echo "▶ [5/5] Verificando .env en servidor..."
if ssh "${SSH_ALIAS}" "test -f ${REMOTE_BACKEND}/.env"; then
  echo "   ✓ .env ya existe en el servidor"
else
  echo "   ⚠ ATENCIÓN: No existe .env en ${REMOTE_BACKEND}/"
  echo "   Ejecuta este comando para crearlo:"
  echo ""
  echo "     ssh ${SSH_ALIAS}"
  echo "     cp ${REMOTE_BACKEND}/.env.example ${REMOTE_BACKEND}/.env"
  echo "     nano ${REMOTE_BACKEND}/.env"
  echo ""
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "   Deploy completado exitosamente 🎉"
echo "   Portal:  ${APP_PUBLIC_URL:-https://$SSH_HOST}"
echo "   Finance: ${APP_PUBLIC_URL:-https://$SSH_HOST}/finance/"
echo "═══════════════════════════════════════════════"
echo ""
echo "   ⚠ Migraciones / admin setup:"
echo "     mysql ... < database/migrations/006_user_roles.sql"
echo "     mysql ... < database/scripts/promote_admin.sql"
echo "     php ${REMOTE_BACKEND}/scripts/setup_admin_password.php 'YourPassword'"
echo "     Agrega ALLOW_PUBLIC_REGISTRATION=false al .env del servidor"
echo ""
