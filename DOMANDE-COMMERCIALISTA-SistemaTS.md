# Domande per il commercialista — Invio spese sanitarie al Sistema TS (730)

**Contesto:** Dr. Salvatore Susino, medico (ecografie), regime forfettario.
Ho un gestionale (RefertEco) che è già tecnicamente in grado di inviare in
automatico le spese sanitarie al Sistema Tessera Sanitaria. Prima di attivarlo
"sul reale" ho bisogno di confermare alcuni punti fiscali/normativi.

---

## 1. Sono obbligato all'invio?
- Da medico in **regime forfettario**, sono tenuto a trasmettere le spese
  sanitarie al Sistema TS per il 730 precompilato? (La mia comprensione è di **sì**,
  perché l'obbligo è legato alla professione/iscrizione all'albo e non al regime,
  ma vorrei conferma.)
- Da quando decorre l'obbligo nel mio caso? Ci sono spese pregresse da recuperare?

## 2. Quale documento emetto al paziente?
- Da forfettario, per le prestazioni mediche emetto **fattura** o **ricevuta**?
- Le prestazioni mediche (ecografie diagnostiche) sono **esenti IVA**
  (art. 10) → nel TS userei `naturaIVA = N2`. È corretto?
- Tipo spesa: per le ecografie specialistiche userei `tipoSpesa = SR`
  (prestazioni di assistenza specialistica). Confermi?

## 3. Numero del documento
- Il numero che invio al Sistema TS deve **coincidere** col numero della
  fattura/ricevuta che consegno al paziente. Confermi che è questo il numero da
  usare (e non un protocollo interno)?
- Devo tenere una numerazione progressiva annuale unica delle ricevute/fatture?

## 4. Opposizione del paziente
- Il paziente può opporsi all'invio dei suoi dati al Sistema TS
  (flag opposizione). Come devo gestirlo e documentarlo? Serve una modulistica
  da far firmare?

## 5. Pagamento tracciato
- Per le spese **detraibili**, il pagamento deve essere **tracciato**
  (bancomat/carta/bonifico), salvo eccezioni. I pagamenti in contanti incidono
  sulla detraibilità? Come li segnalo nel TS?

## 6. Credenziali Sistema TS (parte operativa)
Per attivare l'invio reale mi servono i miei dati corretti:
- **Codice fiscale** (erogatore)
- **Partita IVA**
- **Codice ufficio** Sistema TS (formato regione-asl-ssa, es. 604-120-010011)
- **Pincode** Sistema TS
- **Username e password** Sistema TS
Confermi quali sono i miei valori corretti / dove recuperarli?

## 7. Scadenze
- Qual è la **periodicità** dell'invio (mensile? entro fine mese successivo)?
- C'è una scadenza annuale di chiusura?

---

*Nota tecnica: il sistema è già stato testato con successo sull'ambiente di
prova del MEF (esito 000, protocollo assegnato). Manca solo la conferma
normativa e il passaggio in produzione.*
