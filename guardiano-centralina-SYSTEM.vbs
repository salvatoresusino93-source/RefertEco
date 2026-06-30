' ============================================================
'  GUARDIANO CENTRALINA WORKLIST  (HP .166)  — SYSTEM context
'  Parte all'accensione tramite Scheduled Task (SYSTEM, AtStartup).
'  Tiene accesa la centralina: la avvia e ci resta agganciato;
'  appena si chiude o va in crash, la riavvia subito.
'
'  IMPORTANTE: usa percorsi HARDCODED (non variabili d'ambiente).
'  Sotto il contesto SYSTEM, %USERPROFILE% e %LOCALAPPDATA%
'  puntano al profilo C:\Windows\System32\config\systemprofile,
'  NON al profilo dell'utente User → i percorsi sarebbero sbagliati.
'  Quindi hardcoded a C:\Users\User\...
' ============================================================
Option Explicit
Dim sh, fso, nodeExe, srcDir, logFile, code

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Percorsi HARDCODED per funzionare sotto SYSTEM
nodeExe = "C:\Users\User\AppData\Local\RefertEco\node.exe"
srcDir  = "C:\Users\User\Desktop\RefertEco"
logFile = srcDir & "\guardiano-SYSTEM.log"

Scrivi "Guardiano SYSTEM avviato (anche senza login). Tengo accesa la centralina worklist."

Do
  Scrivi "Avvio la centralina..."
  ' 0 = finestra nascosta ; True = ASPETTA che la centralina si chiuda.
  code = sh.Run("cmd /c cd /d """ & srcDir & """ && """ & nodeExe & """ centralina-worklist.js", 0, True)
  Scrivi "La centralina si e' chiusa (codice " & code & "). La riavvio tra 5 secondi."
  WScript.Sleep 5000
Loop

Sub Scrivi(testo)
  On Error Resume Next
  Dim f
  Set f = fso.OpenTextFile(logFile, 8, True)   ' 8 = append, True = crea se manca
  f.WriteLine Now & "  " & testo
  f.Close
  On Error Goto 0
End Sub
