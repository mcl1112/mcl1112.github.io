// ============================================================
// DADOS: CONTA DO CLIENTE (Supabase Auth por e-mail/senha)
// ============================================================
// IMPORTANTE (configuração no painel do Supabase):
// Authentication > Settings > desligue "Confirm email" para que o
// cadastro já entre logado na hora, sem precisar clicar em link de
// e-mail. Sem isso, o signUp funciona mas o app não consegue ligar
// o pedido à conta até o cliente confirmar o e-mail e logar de novo.

async function restoreSession(){
  try{
    const { data } = await supabaseClient.auth.getSession();
    state.customerUser = data && data.session ? data.session.user : null;
    if(state.customerUser) await loadCustomerProfile();
  }catch(e){ state.customerUser = null; }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    state.customerUser = session ? session.user : null;
    if(state.customerUser) await loadCustomerProfile();
    else state.customerProfile = null;
  });
}

async function loadCustomerProfile(){
  try{
    const { data, error } = await supabaseClient
      .from('profiles').select('*').eq('id', state.customerUser.id).single();
    if(error || !data) throw error;
    state.customerProfile = { id: data.id, name: data.name, phone: data.phone };
    state.customer.name = data.name || '';
    state.customer.phone = data.phone || '';
  }catch(e){
    state.customerProfile = null;
  }
}

async function signUpCustomer(email, password, name, phone){
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if(error) return { error };
  if(data.user){
    await supabaseClient.from('profiles').upsert({ id: data.user.id, name, phone });
  }
  state.customerUser = data.user;
  await loadCustomerProfile();
  return { data };
}

async function signInCustomer(email, password){
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error) return { error };
  state.customerUser = data.user;
  await loadCustomerProfile();
  return { data };
}

async function signOutCustomer(){
  await supabaseClient.auth.signOut();
  state.customerUser = null;
  state.customerProfile = null;
}
