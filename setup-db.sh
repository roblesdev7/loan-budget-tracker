#!/usr/bin/env bash
# =============================================================================
# setup-db.sh — Corre UNA SOLA VEZ en el servidor vía SSH para crear la BD.
#
# Desde tu máquina local:
#   scp -P 65002 setup-db.sh usuario@tudominio.com:~/
#   ssh -p 65002 usuario@tudominio.com "bash ~/setup-db.sh"
# =============================================================================
set -euo pipefail

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│     Loan & Budget — Database Setup           │"
echo "└─────────────────────────────────────────────┘"
echo ""

# ── Pedir credenciales ────────────────────────────────────────────────────────
read -rp "Host MySQL (default: localhost): " DB_HOST
DB_HOST="${DB_HOST:-localhost}"

read -rp "Nombre de la base de datos: " DB_NAME
read -rp "Usuario MySQL: " DB_USER
read -rsp "Contraseña MySQL: " DB_PASS
echo ""

# ── Verificar que mysql CLI esté disponible ───────────────────────────────────
if ! command -v mysql &> /dev/null; then
  echo "ERROR: 'mysql' CLI no encontrado. En Hostinger shared hosting prueba: mysql5"
  exit 1
fi

# ── Importar schema ───────────────────────────────────────────────────────────
SCHEMA_FILE=~/schema.sql

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "ERROR: No se encontró ~/schema.sql"
  echo "Sube primero el schema:"
  echo "  scp -P 65002 database/schema.sql usuario@tudominio.com:~/"
  exit 1
fi

echo ""
echo "▶ Importando schema a la BD '${DB_NAME}'..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SCHEMA_FILE"
echo "   ✓ Schema importado correctamente"

echo ""
echo "▶ Creando .env de producción..."
ENV_FILE=~/public_html/api/.env

if [[ -f "$ENV_FILE" ]]; then
  echo "   ⚠ .env ya existe, se omite. Edítalo manualmente si es necesario."
else
  cat > "$ENV_FILE" << EOF
JWT_SECRET=$(openssl rand -hex 32)
DB_HOST=${DB_HOST}
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
ALLOWED_ORIGINS=https://tudominio.com
EOF
  chmod 600 "$ENV_FILE"
  echo "   ✓ .env creado en ${ENV_FILE}"
  echo "   ⚠ Edita ALLOWED_ORIGINS con tu dominio real:"
  echo "     nano ${ENV_FILE}"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "   Base de datos configurada exitosamente ✓"
echo "═══════════════════════════════════════════════"
echo ""
