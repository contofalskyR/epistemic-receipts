#!/usr/bin/env bash
# run-sql.sh — run the paper's read-only census queries (docs/paper/sql/*.sql)
# against app_ro and write each result to docs/paper/sql/out/<name>.out.
#
#   scripts/paper/run-sql.sh                 # every query
#   scripts/paper/run-sql.sh 03_status_history  # one query (name without .sql)
#
# Reads DATABASE_URL_RO from .env.local (never printed). Every session is
# forced read-only (default_transaction_read_only=on), so even a mistaken
# write in a .sql file fails. The pipeline → domain map is
# docs/paper/domain-map.csv, passed to psql as :domain_map (a VALUES list).
set -euo pipefail
cd "$(dirname "$0")/../.."

set -a
# shellcheck disable=SC1091
source .env.local
set +a
: "${DATABASE_URL_RO:?DATABASE_URL_RO missing from .env.local}"

export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=1800000"
DB="${DATABASE_URL_RO%%\?*}?sslmode=require"
SQL_DIR=docs/paper/sql
OUT_DIR=$SQL_DIR/out
mkdir -p "$OUT_DIR"

# (VALUES ('openalex_v1','scholarly_literature'), …) from the CSV, header skipped.
DOMAIN_MAP="(VALUES $(awk -F, 'NR>1 { gsub(/\047/, "\047\047"); printf "%s(\047%s\047,\047%s\047)", (n++ ? "," : ""), $1, $2 }' docs/paper/domain-map.csv))"

GIT_SHA=$(git rev-parse --short HEAD)
names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  names=()
  for f in "$SQL_DIR"/[0-9]*.sql; do names+=("$(basename "$f" .sql)"); done
fi

for name in "${names[@]}"; do
  f="$SQL_DIR/$name.sql"
  out="$OUT_DIR/$name.out"
  echo "→ $name"
  {
    echo "-- query: $f"
    echo "-- run:   $(date -u +%Y-%m-%dT%H:%M:%SZ) · git $GIT_SHA · role app_ro (read-only session)"
    echo
    psql "$DB" -X -q -v ON_ERROR_STOP=1 -v domain_map="$DOMAIN_MAP" -P pager=off -P footer=off -f "$f"
  } > "$out" 2>&1 || { echo "   FAILED — see $out"; exit 1; }
done
