#!/bin/bash
# 01-create-role-farmaubs-app.sh
# Cria a role de aplicação farmaubs_app (DML, não-dona das tabelas) — AC-02 #37, ADR-016.
# Executado pelo docker-entrypoint-initdb.d do Postgres no primeiro boot do volume.
# Idempotente: atualiza a senha se a role já existir.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<-EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'farmaubs_app') THEN
    CREATE ROLE farmaubs_app
      LOGIN PASSWORD '${FARMAUBS_APP_DB_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE farmaubs_app
      WITH LOGIN PASSWORD '${FARMAUBS_APP_DB_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;
EOSQL