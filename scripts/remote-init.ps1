Param(
  [switch]$SkipMigrate
)

Write-Host "== remote-init (PowerShell): starting =="

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not on PATH. Aborting."
  exit 1
}

Write-Host "Installing dependencies (npm ci)..."
npm ci

Write-Host "Generating Prisma client..."
npx prisma generate

if (-not $SkipMigrate) {
  Write-Host "Running Prisma migrate dev --name init..."
  npx prisma migrate dev --name init
} else {
  Write-Host "Skipping migrate step (SkipMigrate set)."
}

Write-Host "Running seed script..."
npm run seed

Write-Host "== remote-init: completed =="
