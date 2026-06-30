' ============================================================
'  Apre RefertEco nel browser quando il motore e' pronto.
'  Aspetta fino a 60 secondi, poi apre automaticamente.
'  Doppio click per aprire RefertEco in qualsiasi momento.
' ============================================================
Dim sh
Set sh = CreateObject("WScript.Shell")

' Usa PowerShell per aspettare che la porta 3000 risponda (TCP),
' poi apre il browser. Tutto invisibile, nessuna finestra.
sh.Run "powershell -NonInteractive -WindowStyle Hidden -Command """ & _
  "$t=0;" & _
  "while($t -lt 60){" & _
    "try{" & _
      "$c=New-Object System.Net.Sockets.TcpClient;" & _
      "$c.Connect('localhost',3000);" & _
      "$c.Close();" & _
      "break" & _
    "}catch{}" & _
    ";Start-Sleep -Milliseconds 500;" & _
    "$t++" & _
  "};" & _
  "Start-Process 'http://localhost:3000/'""", 0, False
