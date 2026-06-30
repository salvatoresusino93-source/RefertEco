# ============================================================
#  SETUP TASK CENTRALINA WORKLIST — HP .166
#  Da eseguire UNA SOLA VOLTA come Amministratore sull'HP.
#  Registra la centralina worklist come Scheduled Task di Windows
#  che parte automaticamente ALL'ACCENSIONE, senza aspettare il login.
# ============================================================
#
#  Come usarlo:
#  1. Clic destro su questo file → "Esegui con PowerShell"
#  2. Quando appare la finestra UAC (controllo account), clicca "Sì"
#  3. La centralina parte subito e ripartirà da sola ad ogni accensione.
# ============================================================

$TaskName = "RefertEco Centralina Worklist"
$VbsPath  = "C:\Users\User\Desktop\RefertEco\guardiano-centralina-SYSTEM.vbs"

# Rimuove eventuale task precedente (ignora errore se non esiste)
try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop }
catch {}

$action   = New-ScheduledTaskAction   -Execute "wscript.exe" -Argument "`"$VbsPath`""
$trigger  = New-ScheduledTaskTrigger  -AtStartup
$settings = New-ScheduledTaskSettingsSet `
              -ExecutionTimeLimit      (New-TimeSpan -Seconds 0) `
              -AllowStartIfOnBatteries `
              -DontStopIfGoingOnBatteries `
              -MultipleInstances       IgnoreNew
$principal = New-ScheduledTaskPrincipal `
              -UserId    "SYSTEM" `
              -LogonType ServiceAccount `
              -RunLevel  Highest

Register-ScheduledTask `
  -TaskName  $TaskName `
  -Action    $action `
  -Trigger   $trigger `
  -Settings  $settings `
  -Principal $principal `
  -Force

Write-Host "Task '$TaskName' registrato. Avvio immediato..."
Start-ScheduledTask -TaskName $TaskName
Write-Host "Fatto! La centralina è attiva e partirà automaticamente ad ogni accensione."
Write-Host "Log di verifica: C:\Users\User\Desktop\RefertEco\guardiano-SYSTEM.log"
