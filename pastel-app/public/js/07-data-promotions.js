// ============================================================
// DADOS: PROMOÇÕES / COMBOS (aba "Descontos" da equipe)
// ============================================================
async function loadPromotions(){
  try{
    const { data, error } = await supabaseClient.from('promotions').select('*').order('name');
    if(error) throw error;
    if(!data || data.length === 0){
      await seedDefaultPromotions();
      return;
    }
    state.promotions = data.map(rowToPromotion);
  }catch(e){
    console.warn('Não foi possível carregar promoções do Supabase, usando padrão local.', e);
    state.promotions = DEFAULT_PROMOTIONS.map(p=>({...p}));
  }
}
function rowToPromotion(row){
  return {
    id: row.id, type: row.type, name: row.name, active: row.active !== false,
    cat_a: row.cat_a, qty_a: row.qty_a, cat_b: row.cat_b, qty_b: row.qty_b,
    min_subtotal: row.min_subtotal, value: Number(row.value)
  };
}
async function seedDefaultPromotions(){
  const { error } = await supabaseClient.from('promotions').insert(DEFAULT_PROMOTIONS);
  if(error) console.error('Falha ao criar promoção padrão no Supabase', error);
  state.promotions = DEFAULT_PROMOTIONS.map(p=>({...p}));
}
async function savePromotion(promo){
  const { error } = await supabaseClient.from('promotions').upsert(promo);
  if(error) console.error('Falha ao salvar promoção no Supabase', error);
}
async function deletePromotionRemote(id){
  const { error } = await supabaseClient.from('promotions').delete().eq('id', id);
  if(error) console.error('Falha ao remover promoção no Supabase', error);
}

// ---------- SACOLA: itens, total e promoções aplicadas ----------
function cartItems(){
  return Object.entries(state.cart)
    .filter(([id,qty]) => qty > 0)
    .map(([id,qty]) => ({...state.menu.find(m=>m.id===id), qty}))
    .filter(i => i.id);
}
function cartCount(){ return cartItems().reduce((s,i)=>s+i.qty,0) + customCartCount(); }

function calcTotals(){
  const items = cartItems();
  const subtotal = round2(
    items.reduce((s,i)=>s+i.price*i.qty,0) +
    state.customCart.reduce((s,l)=>s+customLineTotal(l),0)
  );
  // quantidade por categoria (o pastel personalizado conta na categoria "Personalizado")
  const catQty = cat =>
    items.filter(i=>i.cat===cat).reduce((s,i)=>s+i.qty,0) + (cat === CUSTOM_CAT ? customCartCount() : 0);
  let discount = 0;
  const applied = [];

  (state.promotions || []).filter(p => p.active !== false).forEach(promo => {
    if(promo.type === 'combo' && promo.cat_a && promo.cat_b && promo.qty_a && promo.qty_b){
      const qtyA = catQty(promo.cat_a);
      const qtyB = catQty(promo.cat_b);
      const combos = Math.min(Math.floor(qtyA/promo.qty_a), Math.floor(qtyB/promo.qty_b));
      if(combos > 0){
        const amount = combos * promo.value;
        discount += amount;
        applied.push({ name: promo.name, amount });
      }
    } else if(promo.type === 'percent' && subtotal >= (promo.min_subtotal || 0) && subtotal > 0){
      const amount = subtotal * (promo.value / 100);
      discount += amount;
      applied.push({ name: promo.name, amount });
    } else if(promo.type === 'fixed' && subtotal >= (promo.min_subtotal || 0) && subtotal > 0){
      discount += promo.value;
      applied.push({ name: promo.name, amount: promo.value });
    }
  });

  discount = Math.min(discount, subtotal);
  return { subtotal, discount, total: subtotal - discount, applied };
}
