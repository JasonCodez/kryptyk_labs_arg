$p = 'D:\projects\kryptyk_labs_arg\node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node'
Write-Host "Path: $p"
$exists = Test-Path -Path $p
Write-Host "Exists: $exists"
if ($exists) {
    Write-Host '--- File info ---'
    Get-Item $p | Format-List FullName, Length, LastWriteTime
    Write-Host '--- Authenticode signature ---'
    $sig = Get-AuthenticodeSignature $p
    Write-Host "Status: $($sig.Status)"
    Write-Host "StatusMessage: $($sig.StatusMessage)"
    if ($sig.SignerCertificate) { Write-Host "Signer: $($sig.SignerCertificate.Subject)" }
    Write-Host '--- SHA256 hash ---'
    Get-FileHash $p -Algorithm SHA256 | Format-List
}