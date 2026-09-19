// ============================================================
// DADOS: CARDÁPIO
// ============================================================
async function loadMenu(){
  try{
    const { data, error } = await supabaseClient.from('menu_items').select('*').order('cat');
    if(error) throw error;
    if(!data || data.length === 0){
      await seedDefaultMenu();
      return;
    }
    state.menu = data.map(rowToMenuItem);
  }catch(e){
    console.warn('Não foi possível carregar cardápio do Supabase, usando padrão local.', e);
    state.menu = DEFAULT_MENU.map(m=>({...m}));
  }
}
function rowToMenuItem(row){
  return {
    id: row.id, cat: row.cat, name: row.name, desc: row.description,
    price: Number(row.price), emoji: row.emoji, image: row.image,
    badge: row.badge, highlight: !!row.highlight, active: row.active !== false
  };
}
function menuItemToRow(item){
  return {
    id: item.id, cat: item.cat, name: item.name, description: item.desc,
    price: item.price, emoji: item.emoji, image: item.image,
    badge: item.badge, highlight: !!item.highlight, active: item.active !== false
  };
}
async function seedDefaultMenu(){
  const rows = DEFAULT_MENU.map(menuItemToRow);
  const { error } = await supabaseClient.from('menu_items').insert(rows);
  if(error) console.error('Falha ao popular cardápio inicial no Supabase', error);
  state.menu = DEFAULT_MENU.map(m=>({...m}));
}
async function saveMenuItem(item){
  const { error } = await supabaseClient.from('menu_items').upsert(menuItemToRow(item));
  if(error) console.error('Falha ao salvar item do cardápio no Supabase', error);
}
async function deleteMenuItemRemote(id){
  const { error } = await supabaseClient.from('menu_items').delete().eq('id', id);
  if(error) console.error('Falha ao remover item do cardápio no Supabase', error);
}
