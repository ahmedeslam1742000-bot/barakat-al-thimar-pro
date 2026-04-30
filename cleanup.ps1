$file = "e:\الموقع\src\pages\vouchers\VoucherWorkspace.jsx"
$lines = Get-Content $file
$newLines = $lines[0..323] + $lines[332..($lines.Count-1)]
$newLines | Set-Content $file
Write-Host ("Done. Was " + $lines.Count + " now " + $newLines.Count + " lines")
