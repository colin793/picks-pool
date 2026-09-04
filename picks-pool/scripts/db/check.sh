#!/usr/bin/env bash
# Applies the schema to a throwaway local Postgres and runs the policy tests.
# Needs psql and a reachable database (default: postgres://claude:claude@localhost/pool).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${DATABASE_URL:-postgres://claude:claude@localhost/pool}"
run() { psql "$DB" -v ON_ERROR_STOP=1 -q -f "$1"; }
run scripts/db/supabase-stub.sql
run supabase/reset.sql 2>/dev/null
run supabase/schema.sql
psql "$DB" -v ON_ERROR_STOP=1 -f scripts/db/policy-test.sql 2>&1 \
  | grep -E "NOTICE|WARNING|ERROR" | sed -E 's/^psql:[^:]+:[0-9]+: (NOTICE|WARNING):  //'
