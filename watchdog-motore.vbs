' ============================================================
'  GUARDIANO MOTORE RefertEco  (Acer)
'  Parte all'accensione e resta in background per sempre.
'  Tiene acceso il motore: lo avvia e ci resta agganciato;
'  appena il motore si chiude o va in crash, lo riavvia subito.
'  Tutto invisibile. Scrive un diario in guardiano.log.
' ============================================================
Option Explicit
Dim sh, fso, userProfile, localApp, nodeExe, srcDir, logFile, code, falliti
falliti = 0

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
  '
  ' NODE_PATH dice a node dove sono le librerie: stanno nella cartella di
  ' installazione (%LOCALAPPDATA%\RefertEco\node_modules), non accanto a
  ' server.js. Senza questa riga node non trovava express, si chiudeva
  ' subito con codice 1 e il guardiano riprovava all'infinito ogni 3
  ' secondi senza mai riuscirci (succedeva dal 28/06/2026).
  ' La forma  set "VAR=..."  con le virgolette serve perche' il percorso
  ' contiene uno spazio nel nome utente.
  code = sh.Run("cmd /c cd /d """ & srcDir & """ && set ""NODE_PATH=" & _
    localApp & "\RefertEco\node_modules"" && """ & nodeExe & """ server.js", 0, True)
  Scrivi "Il motore si e' chiuso (codice " & code & "). Lo riavvio tra 3 secondi."

  ' Se il motore muore subito e di continuo (per esempio una libreria che
  ' manca), riprovare ogni 3 secondi per sempre riempie solo il diario.
  ' Dopo 20 fallimenti di fila si rallenta a un tentativo al minuto.
  If code <> 0 Then
    falliti = falliti + 1
  Else
    falliti = 0
  End If
  If falliti >= 20 Then
    Scrivi "Venti avvii falliti di fila: qualcosa non va. Rallento a un tentativo al minuto."
    WScript.Sleep 60000
  Else
    WScript.Sleep 3000
  End If
Loop

Sub Scrivi(testo)
  On Error Resume Next
  Dim f
  Set f = fso.OpenTextFile(logFile, 8, True)   ' 8 = append, True = crea se manca
  f.WriteLine Now & "  " & testo
  f.Close
  On Error Goto 0
End Sub
