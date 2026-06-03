$SRC  = "$env:USERPROFILE\Desktop\RefertEco"
$INST = "$env:LOCALAPPDATA\RefertEco"

Write-Host "`n  Aggiornamento da GitHub..." -ForegroundColor Cyan
git -C $SRC pull --quiet 2>$null

Write-Host "  RefertEco in avvio...`n" -ForegroundColor Cyan

$env:NODE_PATH = "$INST\node_modules"
Set-Location $SRC

$proc = Start-Process -FilePath "$INST\node.exe" -ArgumentList "server.js" -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\referteco.log" -RedirectStandardError "$env:TEMP\referteco-err.log"

# Attendi che il server risponda sulla porta 3000
$tries = 0
while ($tries -lt 30) {
    Start-Sleep -Seconds 1
    $tries++
    try {
        $tcp = New-Object Net.Sockets.TcpClient
        $tcp.Connect('127.0.0.1', 3000)
        $tcp.Close()
        break
    } catch {}
}

# Apri in modalita' app (finestra pulita senza barra indirizzi/tab)
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    $app = Start-Process $chrome -PassThru -ArgumentList "--app=http://localhost:3000",
        "--window-size=1400,900",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=`"$INST\chrome-profile`""

    # Quando l'utente chiude la finestra RefertEco, ferma anche il server
    while ($true) {
        Start-Sleep -Seconds 2
        if ($app.HasExited) { break }
        if ($proc.HasExited)  { break }
    }
    if (-not $proc.HasExited) { $proc.Kill() }
} else {
    Start-Process "http://localhost:3000"
    while (-not $proc.HasExited) { Start-Sleep -Seconds 5 }
}
