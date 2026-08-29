# Collaudo — prova che il sistema funziona davvero

Questa è la prova pratica da fare **sul sistema vero**, con dati veri, dopo
ogni modifica importante. Serve perché i test automatici verificano il
codice in laboratorio, ma non dimostrano che la catena completa
(sito → database → email → SMS → click del paziente → agenda) funzioni in
produzione.

**Perché esiste questo file.** In passato alcune funzioni risultavano
"testate e funzionanti" negli appunti ma erano rotte nella realtà: il badge
di conferma presenza era sparito in un merge, e il link "Conferma"
nell'email al medico puntava a un dominio che lo deviava in silenzio, senza
lasciare traccia nei log. Entrambi i casi sarebbero emersi in cinque minuti
con questa procedura.

Tempo necessario: **circa 15 minuti.** Non serve competenza tecnica.

---

## Prima di iniziare

Ti serve:
- il tuo telefono (per ricevere gli SMS)
- la tua email
- un codice fiscale valido come formato (va bene il tuo)

⚠️ Userai il sistema come farebbe un paziente: creerai un appuntamento
finto, che alla fine dovrai cancellare.

---

## Test 1 — Prenotazione online e conferma del medico

**Cosa dimostra:** che la prenotazione dal sito arriva, che l'email al
medico parte, che il pulsante "Conferma" funziona davvero e che l'SMS di
conferma raggiunge il paziente.

1. Apri **https://referteco-production.up.railway.app/prenota**
2. Compila con i tuoi dati (nome inventato va bene, ma **telefono ed email
   veri**), scegli un esame e un orario qualsiasi
3. Alla domanda sul pagamento scegli **"paga in studio"**
   (il pagamento online segue un percorso diverso, si conferma da solo)
4. Invia la prenotazione

✅ **Deve succedere:**
- [ ] In agenda compare l'appuntamento con stato **"In attesa"**
- [ ] Ti arriva un'**email arancione** "🌐 Nuova prenotazione online" con
      due pulsanti, Conferma e Rifiuta

5. Nell'email, clicca il pulsante verde **"✅ Conferma"**

✅ **Deve succedere:**
- [ ] Si apre una **pagina verde** "Appuntamento confermato"
      (se ti ritrovi sul sito vetrina studiosusino.it, il bug del dominio
      è tornato — vedi PR #1)
- [ ] In agenda l'appuntamento passa a **"Prenotato"**
- [ ] Ti arriva un **SMS di conferma** sul telefono, con i due recapiti
      dello studio (0932 954441 - 339 4028454)
- [ ] L'appuntamento compare sul **Google Calendar** del medico

### Variante — conferma dall'agenda invece che dall'email

Fai un secondo giro del Test 1, ma al posto del punto 5 apri l'appuntamento
in agenda e cambia lo stato in **"Prenotato"** dal pulsante lì, senza
passare dall'email.

✅ **Deve succedere esattamente lo stesso** di sopra: SMS al paziente ed
evento sul Google Calendar. Se manca uno dei due, il bug per cui approvare
dall'agenda non avvisava nessuno (PR #10) è tornato.

---

## Test 2 — Promemoria e risposta del paziente

**Cosa dimostra:** che il promemoria parte, che il link funziona, e che la
risposta del paziente si vede in agenda.

Il promemoria automatico parte alle **08:00 del giorno prima**
dell'appuntamento. Per non aspettare, forzalo a mano.

1. Assicurati di avere in agenda un appuntamento **per domani** (usa quello
   del Test 1, spostandolo a domani se serve)
2. Apri il Terminale (Mac: cerca "Terminale"; Windows: "PowerShell")
3. Incolla ed esegui:

```
curl -X POST https://referteco-production.up.railway.app/api/reminder/test
```

✅ **Deve succedere:**
- [ ] Il comando risponde con `"ok":true` e `"inviati":1` (o più)
- [ ] Ti arriva l'**SMS di promemoria** con il link "Conferma o disdici qui"

4. **Apri il link** dell'SMS dal telefono

✅ **Deve succedere:**
- [ ] Si apre una pagina con nome, esame, data e due pulsanti grandi

5. Premi **"✅ CONFERMO"**

✅ **Deve succedere:**
- [ ] Compare "Presenza confermata"
- [ ] **In agenda appare la spunta verde ✅** accanto all'orario
      dell'appuntamento (sia nel calendario che nella barra "oggi")
- [ ] Aprendo l'appuntamento, la riga **"Presenza"** dice
      *"✅ Confermata dal paziente"*

---

## Test 3 — Disdetta

**Cosa dimostra:** che una disdetta libera davvero lo slot ovunque e ti
avvisa — non solo in agenda, ma anche sul Google Calendar del medico
(altrimenti lo slot risulta libero in agenda ma bloccato dall'evento
rimasto sul calendario, e quindi non torna prenotabile dal sito).

1. Riapri lo stesso link dell'SMS
2. Premi **"❌ NON POSSO VENIRE"**

✅ **Deve succedere:**
- [ ] Compare "Appuntamento disdetto"
- [ ] **L'appuntamento sparisce dall'agenda** (non resta grigio: sparisce)
- [ ] **L'evento sparisce anche dal tuo Google Calendar** — controlla
      direttamente nell'app/sito di Google Calendar, non solo in agenda
- [ ] Ti arriva un'**email** "❌ Appuntamento annullato"
- [ ] Quello slot torna **prenotabile** dal sito

---

## Al termine

- [ ] Cancella dall'agenda eventuali appuntamenti finti rimasti
- [ ] Cancella il paziente finto, se ne hai creato uno

---

## Se qualcosa non torna

Annota **quale casella non si è spuntata** e cosa hai visto invece. È
l'informazione che serve per capire dove si è rotta la catena: ogni punto
di questa lista corrisponde a un pezzo diverso del sistema.

Per i problemi di invio (email o SMS che non partono affatto) i due comandi
di diagnostica sono:

```
curl -X POST https://referteco-production.up.railway.app/api/test-email \
  -H "Content-Type: application/json" -d '{"to":"tua@email.it"}'

curl -X POST https://referteco-production.up.railway.app/api/test-sms \
  -H "Content-Type: application/json" -d '{"numero":"3394028454"}'
```

Rispondono con l'errore esatto se una chiave di configurazione manca su
Railway.
