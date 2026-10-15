#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'EOSQL'
CREATE ROLE we_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
REVOKE ALL ON DATABASE weight_exercise FROM PUBLIC;
GRANT CONNECT ON DATABASE weight_exercise TO we_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER ROLE we_app SET statement_timeout = '8s';
ALTER ROLE we_app SET idle_in_transaction_session_timeout = '10s';
EOSQL
