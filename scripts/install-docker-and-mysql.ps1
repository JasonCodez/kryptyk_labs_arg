<#
Install Docker Desktop (via winget) and start a MySQL 8 container.
Run this script from an elevated PowerShell prompt (Run as Administrator).
#>

param(
    [string]$MySQLRootPassword = "rootpass",
    [string]$DatabaseName = "kryptyk",
    [string]$ContainerName = "mysql-dev",
    [int]$Port = 3306
)

function Write-Info($msg){ Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Err($msg){ Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1) Ensure winget exists
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget not found. Please install App Installer from the Microsoft Store and re-run this script."
    exit 1
}

# 2) Install Docker Desktop via winget (if not installed)
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerInstalled) {
    Write-Info "Installing Docker Desktop via winget..."
    winget install --id Docker.DockerDesktop -e --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Err "winget install failed (exit code $LASTEXITCODE). You may need to install Docker Desktop manually from https://www.docker.com/get-started"
        exit 1
    }
    Write-Info "Docker Desktop installation requested. You may need to log out / restart for changes to take effect."
}
else {
    Write-Info "Docker command found. Skipping Docker install."
}

# 3) Wait for docker to be available (user may need to start Docker Desktop GUI)
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        try {
            docker version | Out-Null
            Write-Info "Docker is available."
            break
        } catch {
            # docker not responding yet
        }
    }
    $attempt++
    Write-Info "Waiting for Docker to be ready... ($attempt/$maxAttempts)"
    Start-Sleep -Seconds 3
}

if ($attempt -ge $maxAttempts) {
    Write-Err "Docker did not become ready in time. Open Docker Desktop and ensure it's running, then re-run the script."
    exit 1
}

# 4) Pull and run MySQL container
# remove existing container if present
$existing = docker ps -a --filter "name=$ContainerName" --format "{{.ID}}"
if ($existing) {
    Write-Info "Removing existing container named $ContainerName"
    docker rm -f $ContainerName | Out-Null
}

Write-Info "Starting MySQL 8 container named $ContainerName on port $Port (root password from parameter)."
$runCmd = "docker run --name $ContainerName -e MYSQL_ROOT_PASSWORD=$MySQLRootPassword -e MYSQL_DATABASE=$DatabaseName -p $Port:3306 -d mysql:8"
Write-Info $runCmd
Invoke-Expression $runCmd
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start MySQL container (exit code $LASTEXITCODE). Check Docker logs and try again."
    exit 1
}

Write-Info "Container started. Waiting for MySQL to initialize (may take 10-20s)..."
Start-Sleep -Seconds 10

# 5) Show connection example
Write-Host "`n=== SUCCESS ===`n" -ForegroundColor Green
Write-Host "Connect using this DATABASE_URL (example):" -ForegroundColor Yellow
Write-Host "mysql://root:$MySQLRootPassword@127.0.0.1:$Port/$DatabaseName" -ForegroundColor Cyan
Write-Host "`nYou can now run: npx prisma db push && npx prisma generate" -ForegroundColor Green
