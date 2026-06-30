' ============================================================
'  GUARDIANO MOTORE RefertEco  (Acer)
'  Parte all'accensione e resta in background per sempre.
'  Tiene acceso il motore: lo avvia e ci resta agganciato;
'  appena il motore si chiude o va in crash, lo riavvia subito.
'  Tutto invisibile. Scrive un diario in guardiano.log.
' ============================================================
Option Explicit
Dim sh, fso, userProfile, localApp, nodeExe, srcDir, logFile, code

Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
userProfile = sh.ExpandEnvironmentStrings("%USERPROFILE%")
localApp    = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%")
nodeExe = localApp & "\RefertEco\node.exe"
srcDir  = userProfile & "\Desktop\RefertEco"
logFile = srcDir & "\guardiano.log"

Scrivi "Guardiano avviato. Tengo acceso il motore RefertEco."

Do
  Scrivi "Avvio il motore..."
  ' 0 = finestra nascosta ; True = ASPETTA che il motore si chiuda.
  ' cmd /c imposta la cartella di lavoro corretta prima di avviare node.
  code = sh.Run("cmd /c cd /d """ & srcDir & """ && """ & nodeExe & """ server.js", 0, True)
  Scrivi "Il motore si e' chiuso (codice " & code & "). Lo riavvio tra 3 secondi."
  WScript.Sleep 3000
Loop

Sub Scrivi(testo)
  On Error Resume Next
  Dim f
  Set f = fso.OpenTextFile(logFile, 8, True)   ' 8 = append, True = crea se manca
  f.WriteLine Now & "  " & testo
  f.Close
  On Error Goto 0
End Sub
