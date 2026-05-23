const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Variabili d\'ambiente Supabase mancanti. Copia .env.example in .env e compila i valori.'
  );
}

// Usiamo la service key lato backend (bypassa RLS, sicuro perché non esposto al client)
// Il trasporto ws è necessario per Node.js < 22
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

module.exports = supabase;
