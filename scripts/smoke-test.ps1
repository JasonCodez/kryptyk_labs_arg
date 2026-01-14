Write-Output '--- Prisma connect test ---'
try {
  node .\scripts\prisma-connect-test.js
} catch {
  Write-Output 'Node Prisma test command failed to run.'
}

$ports = @(3000,3001)
foreach ($port in $ports) {
  $base = "http://localhost:$port"
  foreach ($path in @('/api/user/info','/api/user/notifications?limit=1&skip=0&unreadOnly=true')) {
    $url = $base + $path
    Write-Output "--- GET $url ---"
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method GET -Headers @{ 'Accept' = 'application/json' } -TimeoutSec 10 -ErrorAction Stop
      Write-Output "Status: $($r.StatusCode)"
      Write-Output "Body:"
      Write-Output $r.Content
    } catch {
      Write-Output "ERROR: $($_.Exception.Message)"
    }
  }
}
