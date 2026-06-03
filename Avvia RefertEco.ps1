$SRC  = "$env:USERPROFILE\Desktop\RefertEco"
$INST = "$env:LOCALAPPDATA\RefertEco"

# Non bloccare mai chiedendo username/password: se mancano credenziali, fallisce
# subito e l'app parte comunque con la versione locale.
$env:GIT_TERMINAL_PROMPT = "0"

# ── SINCRONIZZAZIONE SICURA ───────────────────────────────────────────────
# Obiettivo: le modifiche fatte su un PC non vanno MAI perse e finiscono su
# GitHub, cosi' l'altro PC le riceve. In nessun caso il pull cancella lavoro
# locale: nel peggiore dei casi l'app parte con la versione locale intatta.
Write-Host "`n  Sincronizzazione con GitHub..." -ForegroundColor Cyan

# 1. Salva eventuali modifiche locali in un commit (backup garantito)
git -C $SRC add -A 2>$null
$modifiche = git -C $SRC status --porcelain 2>$null
if ($modifiche) {
    git -C $SRC commit -m "auto-sync da $env:COMPUTERNAME $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null | Out-Null
    Write-Host "  Modifiche locali salvate." -ForegroundColor Yellow
}

# 2. Prendi le novita' dal remoto (rebase mantiene i commit locali in cima)
git -C $SRC pull --rebase --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    # Conflitto o nessuna connessione: annulla il rebase e tieni la versione
    # locale, cosi' l'app funziona comunque. Niente viene perso.
    git -C $SRC rebase --abort 2>$null
    Write-Host "  [Avviso] Sync saltato - avvio con versione locale." -ForegroundColor Yellow
}

# 3. Propaga su GitHub (cosi' l'altro PC riceve tutto)
git -C $SRC push --quiet 2>$null

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
