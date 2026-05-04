# Drop-In Backend Deploy Script for Supabase Cloud (PowerShell)
#
# Prerequisites:
#   1. Install Supabase CLI: npm install -g supabase
#   2. Authenticate: supabase login
#   3. Link to your Supabase project: supabase link --project-ref <PROJECT_REF>
#
# Usage:
#   .\scripts\deploy-supabase.ps1 [-DryRun]
#
# Steps:
#   1. Push database migrations to Supabase Cloud
#   2. Enable required extensions (PostGIS, pg_cron)
#   3. Apply RLS policies
#   4. Configure auth settings

param(
  [switch]$DryRun = $false
)

Write-Host "=== Drop-In: Supabase Cloud Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Push migrations
Write-Host "[1/4] Pushing database migrations..."
if ($DryRun) {
  Write-Host "  DRY-RUN: supabase db push" -ForegroundColor Yellow
}
else {
  npx supabase db push
}
Write-Host "  Done."
Write-Host ""

# Step 2: Enable extensions
Write-Host "[2/4] Verifying extensions (PostGIS, pg_cron)..."
if ($DryRun) {
  Write-Host "  DRY-RUN: supabase db execute 'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_cron;'" -ForegroundColor Yellow
}
else {
  npx supabase db execute --command "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_cron;"
}
Write-Host "  Done."
Write-Host ""

# Step 3: RLS policies
Write-Host "[3/4] Row Level Security policies are applied via migrations."
Write-Host "  Done."
Write-Host ""

# Step 4: Configure auth settings
Write-Host "[4/4] Verifying auth configuration..."
if ($DryRun) {
  Write-Host "  DRY-RUN: supabase config apply" -ForegroundColor Yellow
}
else {
  npx supabase config apply
}
Write-Host "  Done."
Write-Host ""

Write-Host "=== Deployment complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Set environment variables in Vercel:"
Write-Host "     - NEXT_PUBLIC_SUPABASE_URL"
Write-Host "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
Write-Host "  2. Configure Google OAuth in Supabase Dashboard"
Write-Host "  3. Run initial data import: python scripts/extract_osm.py"
Write-Host "  4. Verify cron jobs in Supabase Dashboard > Database > Cron"
