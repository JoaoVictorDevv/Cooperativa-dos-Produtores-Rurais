#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=migrator_password="$COLHEITA_MIGRATOR_PASSWORD" \
  --set=runtime_password="$COLHEITA_RUNTIME_PASSWORD" \
  --set=readonly_password="$COLHEITA_READONLY_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE colheita_owner NOLOGIN')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colheita_owner') \gexec

SELECT format('CREATE ROLE colheita_migrator LOGIN PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colheita_migrator') \gexec

SELECT format('CREATE ROLE colheita_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colheita_runtime') \gexec

SELECT format('CREATE ROLE colheita_readonly LOGIN PASSWORD %L', :'readonly_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'colheita_readonly') \gexec

GRANT colheita_owner TO colheita_migrator;
SELECT format('GRANT CONNECT ON DATABASE %I TO colheita_migrator, colheita_runtime, colheita_readonly', current_database()) \gexec
ALTER ROLE colheita_migrator SET search_path = colheita, public;
ALTER ROLE colheita_runtime SET search_path = colheita, public;
ALTER ROLE colheita_readonly SET search_path = colheita, public;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
