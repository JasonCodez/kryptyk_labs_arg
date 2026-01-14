$p = "D:\projects\kryptyk_labs_arg\node_modules\.prisma\client\query_engine-windows.dll.node"
Write-Output "Path: $p"
Write-Output "Exists: $(Test-Path $p)"
Write-Output "--- File info ---"
if (Test-Path $p) {
    Get-Item $p | Format-List FullName,Length,LastWriteTime
    Write-Output ""
    Write-Output "--- Authenticode signature ---"
    Get-AuthenticodeSignature $p | Format-List Status,StatusMessage
    Write-Output ""
    Write-Output "--- SHA256 hash ---"
    Get-FileHash -Algorithm SHA256 $p | Format-List
} else {
    Write-Output "File not found"
    exit 2
}
