#!/usr/bin/env bash
# Aplica las migraciones al proyecto Supabase de desarrollo.
# `supabase db push` usa el proyecto enlazado por defecto, y ese es producción:
# este script siempre pasa --db-url y rechaza cualquier URL de producción.
#
# Uso:
#   read -rs SUPABASE_DEV_DB_URL && export SUPABASE_DEV_DB_URL
#   scripts/supabase-dev-migrate.sh           # simula, no cambia nada
#   scripts/supabase-dev-migrate.sh --apply   # aplica las migraciones
set -euo pipefail

cd "$(dirname "$0")/.."

prod_ref_file="supabase/.temp/project-ref"
mode="${1:-}"

if [[ -n "$mode" && "$mode" != "--apply" ]]; then
  echo "Opción desconocida: $mode. La única opción es --apply." >&2
  exit 2
fi

if [[ -z "${SUPABASE_DEV_DB_URL:-}" ]]; then
  echo "Falta SUPABASE_DEV_DB_URL. Ver docs/01-engineering/environments.md." >&2
  exit 2
fi

if [[ ! -s "$prod_ref_file" ]]; then
  echo "No se encontró $prod_ref_file: no se puede descartar que la URL sea de producción." >&2
  exit 2
fi

prod_ref="$(tr -d '[:space:]' < "$prod_ref_file")"
if [[ "$SUPABASE_DEV_DB_URL" == *"$prod_ref"* ]]; then
  echo "Abortado: SUPABASE_DEV_DB_URL apunta a producción." >&2
  exit 1
fi

supabase_bin="${SUPABASE_BIN:-}"
if [[ -z "$supabase_bin" ]]; then
  if command -v supabase > /dev/null; then
    supabase_bin="supabase"
  else
    supabase_bin="/tmp/supabase-cli/supabase"
  fi
fi

if [[ "$mode" == "--apply" ]]; then
  "$supabase_bin" db push --db-url "$SUPABASE_DEV_DB_URL" --yes
else
  "$supabase_bin" db push --db-url "$SUPABASE_DEV_DB_URL" --dry-run
  echo "Simulación terminada. Para aplicar: scripts/supabase-dev-migrate.sh --apply"
fi
