function dataItaliaCompatta(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}${value('month')}${value('day')}`;
}

async function generaAccessionNumber(supabase, date = new Date()) {
  const dataStr = dataItaliaCompatta(date);
  const { count, error } = await supabase
    .from('appuntamenti')
    .select('*', { count: 'exact', head: true })
    .like('accession_number', `${dataStr}-%`);

  if (error) throw new Error(`Impossibile generare l'Accession Number: ${error.message}`);
  return `${dataStr}-${String((count || 0) + 1).padStart(4, '0')}`;
}

module.exports = { dataItaliaCompatta, generaAccessionNumber };
