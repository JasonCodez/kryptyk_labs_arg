# Kill processes listening on ports 3000 or 3001
$ports = @(3000,3001)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $ownPid = $c.OwningProcess
        if ($ownPid) {
            Write-Output "Stopping process ${ownPid} listening on port ${port}"
            try { Stop-Process -Id $ownPid -Force -ErrorAction SilentlyContinue; Write-Output "Stopped ${ownPid}" } catch { Write-Output "Failed to stop ${ownPid}: ${_}" }
        }
    }
}

# Remove Next cache
Write-Output "Removing .next if present"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Start dev server
Write-Output "Starting npm run dev"
npm run dev
