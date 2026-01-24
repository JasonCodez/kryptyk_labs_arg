<#
runs a local Postgres container, waits for readiness, runs prisma generate, migrate dev, and seed.
Usage (PowerShell elevated):
  cd D:\projects\kryptyk_labs_arg
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
  .\scripts\run-local-setup.ps1
#>

param(
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = "devpass",
  [string]$PostgresContainerName = "local-postgres",
  [int]$PostgresPort = 5432
)

function Fail($msg) { Write-Error $msg; exit 1 }

Write-Host "== run-local-setup: starting =="

# Check docker CLI
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker CLI not found. Ensure Docker Desktop is installed and running."
}

# Remove existing container if present
try {
  $exists = docker ps -a --filter "name=$PostgresContainerName" --format "{{.Names}}" | Where-Object { $_ -eq $PostgresContainerName }
} catch {
  Fail "Failed to query docker containers: $_"
}
if ($exists) {
  Write-Host "Removing existing container $PostgresContainerName..."
  docker rm -f $PostgresContainerName | Out-Null
}

Write-Host "Starting Postgres container ($PostgresContainerName)..."
docker run -d --name $PostgresContainerName -e POSTGRES_USER=$PostgresUser -e POSTGRES_PASSWORD=$PostgresPassword -p ${PostgresPort}:5432 postgres:15 | Out-Null

Write-Host "Waiting for Postgres to accept connections (pg_isready) inside container $PostgresContainerName..."
$timeout = 180
$elapsed = 0
while ($true) {
  docker exec $PostgresContainerName pg_isready -U $PostgresUser -d postgres > $null 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
  $elapsed += 1
  if ($elapsed -ge $timeout) { Fail "Timed out waiting for Postgres to be ready (pg_isready)" }
}
Write-Host "Postgres is ready."

# Set DATABASE_URL for this session (use provided Postgres user)
$env:DATABASE_URL = "postgresql://${PostgresUser}:${PostgresPassword}@127.0.0.1:${PostgresPort}/postgres?schema=public"
Write-Host "DATABASE_URL set to $env:DATABASE_URL"

# Run Prisma generate
Write-Host "Running: npx prisma generate"
$npxgen = npx prisma generate
if ($LASTEXITCODE -ne 0) { Fail "prisma generate failed (exit $LASTEXITCODE)" }

# Run migrate dev
Write-Host "Running: npx prisma migrate dev --name init"
$cmd = "npx prisma migrate dev --name init"
Invoke-Expression $cmd
if ($LASTEXITCODE -ne 0) { Fail "prisma migrate dev failed (exit $LASTEXITCODE)" }

# Run seed
Write-Host "Running: npm run seed"
npm run seed
if ($LASTEXITCODE -ne 0) { Fail "npm run seed failed (exit $LASTEXITCODE)" }

Write-Host "== run-local-setup: completed successfully =="
Write-Host "Next steps (optional):"
Write-Host " - Inspect prisma/migrations, then commit them: git add prisma/migrations prisma/schema.prisma && git commit -m 'chore(prisma): add postgres migrations'"
Write-Host " - Deploy to Render and run 'npx prisma migrate deploy' + seed on Render"

# end
