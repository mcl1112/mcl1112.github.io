// ============================================================
// DADOS: CONFIGURAÇÃO DA LOJA (horários + chave Pix)
// ============================================================
async function loadConfig(){
  try{
    const { data, error } = await supabaseClient.from('config').select('*').eq('id', 1).single();
    if(error || !data) throw error || new Error('sem config');
    state.config = {
      slotInterval: data.slot_interval,
      maxPerSlot: data.max_per_slot,
      minLead: data.min_lead,
      openHour: data.open_hour,
      openMinute: data.open_minute,
      closeHour: data.close_hour,
      closeMinute: data.close_minute,
      maxDaysAhead: data.max_days_ahead,
      pixKey: data.pix_key || '',
      pixKeyType: data.pix_key_type || 'cpf_cnpj',
      merchantName: data.merchant_name || 'Pastelaria',
      merchantCity: data.merchant_city || 'Sao Paulo'
    };
  }catch(e){
    console.warn('Não foi possível carregar config do Supabase, usando padrão.', e);
    state.config = {...DEFAULT_CONFIG};
  }
}
async function saveConfig(){
  const c = state.config;
  const { error } = await supabaseClient.from('config').update({
    slot_interval: c.slotInterval,
    max_per_slot: c.maxPerSlot,
    min_lead: c.minLead,
    open_hour: c.openHour,
    open_minute: c.openMinute,
    close_hour: c.closeHour,
    close_minute: c.closeMinute,
    max_days_ahead: c.maxDaysAhead,
    pix_key: c.pixKey,
    pix_key_type: c.pixKeyType,
    merchant_name: c.merchantName,
    merchant_city: c.merchantCity
  }).eq('id', 1);
  if(error) console.error('Falha ao salvar configurações no Supabase', error);
}
