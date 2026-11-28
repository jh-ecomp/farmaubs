#!/usr/bin/env bash
# ==============================================================================
# FarmaUBS — Backup Automatizado Off-Site do PostgreSQL para Cloudflare R2
# Requisitos: NF006 (Retenção 30 dias) | ADRs: ADR-020 (Fase 1), ADR-025 | RL-08
# ==============================================================================
# Uso padrão na VPS (cron a cada 4h):
#   /opt/farmaubs/infra/scripts/backup-postgres-r2.sh
#
# Variáveis opcionais de sobrescrita (úteis para pré-deploy e testes locais):
#   ENV_FILE          (padrão: /opt/farmaubs/prod/.env)
#   COMPOSE_PROJECT   (padrão: farmaubs-prod)
#   COMPOSE_BASE      (padrão: /opt/farmaubs/infra/docker-compose.yml)
#   COMPOSE_PROD      (padrão: /opt/farmaubs/infra/docker-compose.prod.yml)
#   BACKUP_DIR        (padrão: /tmp/farmaubs-backups)
#   R2_REMOTE         (padrão: r2:farmaubs-backups)
#   RETENTION_DAYS    (padrão: 30)
#   SKIP_RCLONE       (padrão: false — defina "true" em ensaios locais sem R2)
#   KEEP_LOCAL_DUMP   (padrão: false — defina "true" para manter o .dump em BACKUP_DIR)
# ==============================================================================
set -euo pipefail

export TZ="${TZ:-America/Sao_Paulo}"
export MSYS_NO_PATHCONV=1

ENV_FILE="${ENV_FILE:-/opt/farmaubs/prod/.env}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-farmaubs-prod}"
COMPOSE_BASE="${COMPOSE_BASE:-/opt/farmaubs/infra/docker-compose.yml}"
COMPOSE_PROD="${COMPOSE_PROD:-/opt/farmaubs/infra/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/farmaubs-backups}"
R2_REMOTE="${R2_REMOTE:-r2:farmaubs-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
SKIP_RCLONE="${SKIP_RCLONE:-false}"
KEEP_LOCAL_DUMP="${KEEP_LOCAL_DUMP:-false}"

log() {
  printf '[%s] [backup-r2] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERRO: Arquivo de ambiente não encontrado em: $ENV_FILE"
  exit 1
fi

read_env_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

POSTGRES_USER="${POSTGRES_USER:-$(read_env_var POSTGRES_USER)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_var POSTGRES_DB)}"

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  log "ERRO: POSTGRES_USER ou POSTGRES_DB ausentes em $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
DUMP_FILENAME="${POSTGRES_DB}-${TIMESTAMP}.dump"
DUMP_PATH="${BACKUP_DIR}/${DUMP_FILENAME}"

cleanup() {
  if [[ "$KEEP_LOCAL_DUMP" != "true" && -f "$DUMP_PATH" ]]; then
    rm -f "$DUMP_PATH"
  fi
}
trap cleanup EXIT

log "Iniciando pg_dump (-Fc) do banco '${POSTGRES_DB}' na stack '${COMPOSE_PROJECT}'..."
ENV_FILE="$ENV_FILE" docker compose -p "$COMPOSE_PROJECT" \
  -f "$COMPOSE_BASE" \
  -f "$COMPOSE_PROD" \
  exec -T postgres pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DUMP_PATH"

if [[ ! -s "$DUMP_PATH" ]]; then
  log "ERRO: Arquivo de dump gerado está vazio ($DUMP_PATH)."
  exit 1
fi

DUMP_SIZE_BYTES="$(wc -c < "$DUMP_PATH" | tr -d ' ')"
log "Dump local gerado com sucesso: ${DUMP_FILENAME} (${DUMP_SIZE_BYTES} bytes)."

if [[ "$SKIP_RCLONE" == "true" ]]; then
  log "SKIP_RCLONE=true — pulando upload remoto ao Cloudflare R2. Caminho local: ${DUMP_PATH}"
  exit 0
fi

if ! command -v rclone >/dev/null 2>&1; then
  log "ERRO: Utilitário 'rclone' não encontrado no PATH."
  exit 1
fi

log "Enviando ${DUMP_FILENAME} para ${R2_REMOTE}/..."
rclone copyto "$DUMP_PATH" "${R2_REMOTE}/${DUMP_FILENAME}"

log "Aplicando política de retenção mínima de ${RETENTION_DAYS} dias em ${R2_REMOTE}..."
rclone delete "${R2_REMOTE}" --min-age "${RETENTION_DAYS}d"

log "Backup off-site concluído com sucesso (${R2_REMOTE}/${DUMP_FILENAME})."
