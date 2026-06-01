// ═══════════════════════════════════════════════════════════════════════════
// STRIPE — Pagamento online della visita sulla prenotazione
//
// Modello "corsia agevolata": chi paga la visita online (importo intero)
// ottiene la conferma immediata della prenotazione (addebito subito al termine
// del pagamento). Chi non paga online resta in attesa della conferma manuale
// del medico e paga in studio.
//
// Variabili d'ambiente:
//   STRIPE_SECRET_KEY        (obbligatoria per attivare i pagamenti)
//   STRIPE_WEBHOOK_SECRET    (per verificare la firma del webhook)
//   IMPORTO_PAGAMENTO_CENT   (default 8000 = 80,00 €)
//   PUBLIC_BASE_URL          (default https://referteco-production.up.railway.app)
// ═══════════════════════════════════════════════════════════════════════════

const SECRET_KEY     = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
// NB: NON usare APP_URL come fallback — quello punta a conferma.studiosusino.it
// (dominio dei link SMS, che reindirizza al sito vetrina). Gli URL di ritorno del
// pagamento devono restare sul dominio dell'app che serve /prenota.
const BASE_URL       = process.env.PUBLIC_BASE_URL || 'https://referteco-production.up.railway.app';

// Inizializzazione "lazy": se la chiave non è configurata, i pagamenti restano
// disattivati e la prenotazione online funziona solo in modalità "paga in studio".
let stripe = null;
if (SECRET_KEY) {
  stripe = require('stripe')(SECRET_KEY);
} else {
  console.warn('[Stripe] STRIPE_SECRET_KEY non configurata — pagamento online disattivato.');
}

function pagamentiAttivi() {
  return !!stripe;
}

// Importo intero della visita in centesimi (default 80,00 €).
function importoPagamentoCent() {
  const n = parseInt(process.env.IMPORTO_PAGAMENTO_CENT, 10);
  return Number.isFinite(n) && n > 0 ? n : 8000; // default 80,00 €
}

// ─── Crea la sessione di Checkout per il pagamento della visita ───────────
// app: appuntamento con tipi_prestazione(*) e pazienti(*) inclusi.
// L'addebito è immediato (capture automatica) al completamento del pagamento.
// La sessione scade dopo 30 minuti: in caso di abbandono il webhook
// `checkout.session.expired` fa scattare il fallback "paga in studio".
// Ritorna { id, url } oppure null se i pagamenti non sono attivi.
async function creaCheckoutPagamento(app, importoCent) {
  if (!stripe) return null;

  const cent  = importoCent || importoPagamentoCent();
  const esame = app.tipi_prestazione?.nome || 'Ecografia';
  const emailPaziente = app.pazienti?.email || null;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Solo 'card': Google Pay e Apple Pay vengono offerti automaticamente da
    // Stripe sotto 'card'. NB: 'google_pay' NON è un payment_method_type valido
    // e farebbe fallire la creazione del Checkout (fallback a "paga in studio").
    payment_method_types: ['card'],
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min (minimo Stripe)
    // Email del paziente: pre-compila il campo in Checkout e, soprattutto,
    // imposta `receipt_email` sul PaymentIntent così Stripe invia in automatico
    // la propria RICEVUTA DI PAGAMENTO ufficiale al paziente al buon fine del
    // pagamento. NB: l'invio delle ricevute Stripe va abilitato una volta nel
    // Dashboard Stripe (Impostazioni → Email dei clienti → "Ricevute").
    ...(emailPaziente ? {
      customer_email: emailPaziente,
      payment_intent_data: { receipt_email: emailPaziente },
    } : {}),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: cent,
        product_data: {
          name: `${esame} — pagamento visita`,
          description: 'Pagamento della visita per la conferma immediata dell\'appuntamento.',
        },
      },
    }],
    metadata: { appuntamento_id: String(app.id) },
    success_url: `${BASE_URL}/prenota?pagamento=ok`,
    cancel_url:  `${BASE_URL}/prenota?pagamento=annullato`,
  });

  return { id: session.id, url: session.url };
}

// ─── Verifica e decodifica l'evento webhook ───────────────────────────────
function costruisciEventoWebhook(rawBody, signature) {
  if (!stripe) throw new Error('Stripe non configurato');
  if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET non configurato');
  return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
}

module.exports = {
  pagamentiAttivi,
  importoPagamentoCent,
  creaCheckoutPagamento,
  costruisciEventoWebhook,
};
