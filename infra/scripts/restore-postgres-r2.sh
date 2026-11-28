#!/usr/bin/env bash
# ==============================================================================
# FarmaUBS — Restauração e Verificação de Disaster Recovery (PostgreSQL + RLS)
# Requisitos: NF006 (RTO <= 4h), NF015 (Políticas RLS preservadas) | ADR-020 | RL-08
# ==============================================================================
# Modos de operação:
#   1. Ensaio seguro de DR (padrão sem TARGET_CONTAINER):
#      Baixa o .dump mais recente do Cloudflare R2 (ou usa LOCAL_DUMP_FILE),
#      sobe um container PostgreSQL 18 efêmero isolado, executa pg_restore,
#      valida contagem de tabelas + políticas de RLS ativas (pg_policies) e remove o container.
#
#   2. Restauração em container alvo existente (recuperação real):
#      TARGET_CONTAINER="farmaubs-prod-postgres-1" TARGET_DB="farmaubs_prod" TARGET_USER="farmaubs_admin" \
#        /opt/farmaubs/infra/scripts/restore-postgres-r2.sh [nome-do-arquivo.dump]
#
# Variáveis opcionais:
#   LOCAL_DUMP_FILE   - Caminho de um .dump local (dispensa download via rclone)
#   R2_REMOTE         - Bucket remoto no rclone (padrão: r2:farmaubs-backups)
#   TARGET_CONTAINER  - Container Docker PostgreSQL existente onde restaurar (opcional)
#   TARGET_DB         - Banco destino quando TARGET_CONTAINER é informado (padrão: farmaubs_restore)
#   TARGET_USER       - Usuário admin no container alvo (padrão: farmaubs_admin)
# ==============================================================================
set -euo pipefail

export TZ="${TZ:-America/Sao_Paulo}"
export MSYS_NO_PATHCONV=1

R2_REMOTE="${R2_REMOTE:-r2:farmaubs-backups}"
REQUESTED_DUMP="${1:-}"
LOCAL_DUMP_FILE="${LOCAL_DUMP_FILE:-}"
TARGET_CONTAINER="${TARGET_CONTAINER:-}"
TARGET_DB="${TARGET_DB:-farmaubs_restore}"
TARGET_USER="${TARGET_USER:-farmaubs_admin}"
WORK_DIR="$(mktemp -d /tmp/farmaubs-restore.XXXXXX)"
EPHEMERAL_CONTAINER=""

log() {
  printf '[%s] [restore-r2] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"
}

cleanup() {
  if [[ -n "$EPHEMERAL_CONTAINER" ]]; then
    log "Removendo container efêmero de verificação (${EPHEMERAL_CONTAINER})..."
    docker rm -f "$EPHEMERAL_CONTAINER" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

DUMP_TO_RESTORE=""
if [[ -n "$LOCAL_DUMP_FILE" ]]; then
  if [[ ! -s "$LOCAL_DUMP_FILE" ]]; then
    log "ERRO: LOCAL_DUMP_FILE não existe ou está vazio: $LOCAL_DUMP_FILE"
    exit 1
  fi
  DUMP_TO_RESTORE="$LOCAL_DUMP_FILE"
  log "Utilizando arquivo de dump local: ${DUMP_TO_RESTORE}"
else
  if ! command -v rclone >/dev/null 2>&1; then
    log "ERRO: 'rclone' não encontrado no PATH e LOCAL_DUMP_FILE não foi informado."
    exit 1
  fi

  if [[ -z "$REQUESTED_DUMP" ]]; then
    log "Localizando backup mais recente em ${R2_REMOTE}..."
    REQUESTED_DUMP="$(rclone lsf "${R2_REMOTE}" --files-only | grep -E '\.dump$' | sort | tail -n 1)"
  fi

  if [[ -z "$REQUESTED_DUMP" ]]; then
    log "ERRO: Nenhum arquivo .dump encontrado em ${R2_REMOTE}."
    exit 1
  fi

  DUMP_TO_RESTORE="${WORK_DIR}/${REQUESTED_DUMP}"
  log "Baixando ${R2_REMOTE}/${REQUESTED_DUMP}..."
  rclone copyto "${R2_REMOTE}/${REQUESTED_DUMP}" "$DUMP_TO_RESTORE"
fi

if [[ -z "$TARGET_CONTAINER" ]]; then
  EPHEMERAL_CONTAINER="farmaubs-dr-verify-$$"
  TARGET_CONTAINER="$EPHEMERAL_CONTAINER"
  TARGET_USER="farmaubs_admin"
  TARGET_DB="farmaubs_restore"

  log "Subindo container efêmero PostgreSQL 18 (${EPHEMERAL_CONTAINER}) para validação isolada de DR..."
  docker run -d --name "$EPHEMERAL_CONTAINER" \
    -e POSTGRES_USER="$TARGET_USER" \
    -e POSTGRES_PASSWORD="DrVerifyTempPassword123!" \
    -e POSTGRES_DB="$TARGET_DB" \
    postgres:18-alpine >/dev/null

  for _ in $(seq 1 30); do
    if docker exec "$EPHEMERAL_CONTAINER" pg_isready -U "$TARGET_USER" -d "$TARGET_DB" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  # Garante a role não-dona farmaubs_app para que os GRANTs de tabelas/RLS do dump apliquem sem avisos
  docker exec -i "$EPHEMERAL_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$TARGET_USER" -d "$TARGET_DB" <<'EOSQL' >/dev/null
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmaubs_app') THEN
    CREATE ROLE farmaubs_app LOGIN PASSWORD 'DrVerifyAppPassword123!' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
EOSQL
fi

log "Executando pg_restore (--clean --if-exists --no-owner) em ${TARGET_CONTAINER}/${TARGET_DB}..."
docker exec -i "$TARGET_CONTAINER" \
  pg_restore --clean --if-exists --no-owner --exit-on-error -U "$TARGET_USER" -d "$TARGET_DB" < "$DUMP_TO_RESTORE"

TABLE_COUNT="$(docker exec "$TARGET_CONTAINER" psql -tA -U "$TARGET_USER" -d "$TARGET_DB" \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"

RLS_POLICY_COUNT="$(docker exec "$TARGET_CONTAINER" psql -tA -U "$TARGET_USER" -d "$TARGET_DB" \
  -c "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';")"

RLS_FORCED_TABLES="$(docker exec "$TARGET_CONTAINER" psql -tA -U "$TARGET_USER" -d "$TARGET_DB" \
  -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true AND c.relforcerowsecurity = true;")"

log "Validação pós-restore concluída: tabelas=${TABLE_COUNT} | politicas_rls=${RLS_POLICY_COUNT} | tabelas_force_rls=${RLS_FORCED_TABLES}"

if [[ "${TABLE_COUNT:-0}" -lt 5 ]]; then
  log "ERRO: Contagem de tabelas restauradas (${TABLE_COUNT}) abaixo do esperado!"
  exit 1
fi

if [[ "${RLS_POLICY_COUNT:-0}" -lt 1 ]]; then
  log "ERRO: Nenhuma política de Row-Level Security (pg_policies) encontrada após o restore!"
  exit 1
fi

log "SUCESSO: Restauração e integridade de tabelas + políticas RLS verificadas."
