$paths = @(
    'D:\projects\kryptyk_labs_arg\node_modules\@next\swc-win32-x64-msvc\next-swc.win32-x64-msvc.node',
    'D:\projects\kryptyk_labs_arg\node_modules\\.prisma\client\query_engine-windows.dll.node'
)

foreach ($p in $paths) {
    Write-Output "--- Unblocking: $p ---"
    if (Test-Path $p) {
        try {
            Unblock-File $p
            Write-Output 'Unblocked successfully.'
        } catch {
            Write-Output "Unblock-File failed: $_"
        }
    } else {
        Write-Output "Not found: $p"
    }
}

Write-Output '--- Attempting Defender exclusion for project node_modules (may require admin) ---'
try {
    Add-MpPreference -ExclusionPath 'D:\projects\kryptyk_labs_arg\node_modules' -ErrorAction Stop
    Write-Output 'Add-MpPreference succeeded.'
} catch {
    Write-Output "Add-MpPreference failed (may require admin): $_"
}

Write-Output '--- Removing .next ---'
try {
    Remove-Item -Recurse -Force .next -ErrorAction Stop
    Write-Output '.next removed.'
} catch {
    Write-Output 'Failed to remove .next or it did not exist.'
}

Write-Output '--- Starting npm run dev ---'
npm run dev
