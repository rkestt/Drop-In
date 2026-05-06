#!/usr/bin/env bash
# Drop-In Backend Deploy Script for Supabase Cloud
#
# Prerequisites:
#   1. Install Supabase CLI: npm install -g supabase
#   2. Authenticate: supabase login
#   3. Link to your Supabase project: supabase link --project-ref <PROJECT_REF>
#
# Usage:
#   ./scripts/deploy-supabase.sh [--dry-run]
#
# Steps:
#   1. Push database migrations to Supabase Cloud
#   2. Enable required extensions (PostGIS, pg_cron)
#   3. Apply RLS policies
#   4. Configure auth settings

set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

echo "=== Drop-In: Supabase Cloud Deployment ==="
echo ""

# Step 1: Push migrations
echo "[1/4] Pushing database migrations..."
if [ "$DRY_RUN" = true ]; then
  echo "  DRY-RUN: supabase db push"
else
  npx supabase db push
fi
echo "  Done."
echo ""

# Step 2: Enable extensions (handled in migration 001 but idempotent)
echo "[2/4] Verifying extensions (PostGIS, pg_cron)..."
if [ "$DRY_RUN" = true ]; then
  echo "  DRY-RUN: supabase sql 'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_cron;'"
else
  npx supabase db execute --command "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_cron;"
fi
echo "  Done."
echo ""

# Step 3: Apply RLS policies (already part of migrations)
echo "[3/4] Row Level Security policies are applied via migrations."
echo "  Done."
echo ""

# Step 4: Configure auth settings
echo "[4/4] Verifying auth configuration..."
if [ "$DRY_RUN" = true ]; then
  echo "  DRY-RUN: supabase config apply"
else
  npx supabase config apply
fi
echo "  Done."
echo ""

echo "=== Deployment complete ==="
echo ""
echo "Next steps:"
echo "  1. Set environment variables in Vercel:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  2. Configure Google OAuth in Supabase Dashboard"
echo "  3. Run initial data import: python3 scripts/extract_osm.py"
echo "  4. Verify cron jobs in Supabase Dashboard > Database > Cron"
