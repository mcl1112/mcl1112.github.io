// ============================================================
// DADOS: PASTEL PERSONALIZADO
// O cliente escolhe o tamanho (P/M/G) e os recheios.
//  - Preço  = preço base do tamanho + adicional de cada recheio (x fator do tamanho)
//  - Baixa  = massa do tamanho + porção de cada recheio (x fator do tamanho)
// A baixa de verdade acontece no banco (consume_stock); aqui ficam as contas
// que mostram preço e disponibilidade na tela.
// ============================================================

const CUSTOM_CAT = 'Personalizado'; // "categoria" do pastel personalizado nas promoções/combos

// ---------- carregar / salvar ----------
function rowToCustomSize(r){
  return {
    id: r.id, name: r.name, basePrice: Number(r.base_price),
    factor: Number(r.factor), doughQty: Number(r.dough_qty), sort: Number(r.sort || 0)
  };
}

async function loadCustomConfig(){
  try{
    const [sz, st] = await Promise.all([
      supabaseClient.from('custom_sizes').select('*').order('sort'),
      supabaseClient.from('custom_settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if(sz.error) throw sz.error;
    if(st.error) throw st.error;
    state.customSizes = (sz.data || []).map(rowToCustomSize);
    state.customSettings = st.data
      ? { active: st.data.active !== false, doughId: st.data.dough_id || null }
      : { active: true, doughId: null };
  }catch(e){
    console.warn('Pastel personalizado indisponível (rodou a migração migration-personalizado.sql?)', e);
    state.customSizes = [];
    state.customSettings = { active: false, doughId: null };
  }
}

async function saveCustomSizes(sizes){
  const rows = sizes.map(s => ({
    id: s.id, name: s.name, base_price: s.basePrice, factor: s.factor, dough_qty: s.doughQty, sort: s.sort
  }));
  const { error } = await supabaseClient.from('custom_sizes').upsert(rows);
  if(error) console.error('Falha ao salvar tamanhos', error);
  return error || null;
}

async function saveCustomSettings(settings){
  const { error } = await supabaseClient.from('custom_settings')
    .upsert({ id: 1, active: settings.active, dough_id: settings.doughId });
  if(error) console.error('Falha ao salvar configuração do pastel personalizado', error);
  return error || null;
}

async function saveIngredientCustom(id, f){
  const { error } = await supabaseClient.from('ingredients').update({
    custom_enabled: f.customEnabled, custom_category: f.customCategory,
    custom_portion: f.customPortion, custom_price: f.customPrice
  }).eq('id', id);
  if(error) console.error('Falha ao salvar ingrediente do personalizado', error);
  return error || null;
}

// ---------- preço ----------
function customSizeById(id){ return state.customSizes.find(s => s.id === id); }

function customIngredientExtra(ing, size){
  return round2((ing.customPrice || 0) * size.factor);
}
function customUnitPrice(sizeId, ingredientIds){
  const size = customSizeById(sizeId);
  if(!size) return 0;
  let price = size.basePrice;
  for(const id of ingredientIds){
    const ing = ingredientById(id);
    if(ing && ing.customEnabled) price += customIngredientExtra(ing, size);
  }
  return round2(price);
}
function customLineTotal(line){ return round2(customUnitPrice(line.sizeId, line.ingredientIds) * line.qty); }
function customCartCount(){ return state.customCart.reduce((s, l) => s + l.qty, 0); }

function customLineLabel(line){
  const size = customSizeById(line.sizeId);
  return 'Pastel Personalizado' + (size ? ` (${size.name})` : '');
}
function customLineIngredientNames(line){
  return line.ingredientIds.map(id => (ingredientById(id) || {}).name).filter(Boolean);
}
// Como o item aparece dentro do pedido gravado (a equipe vê os recheios)
function customOrderItem(line){
  const size = customSizeById(line.sizeId);
  return {
    name: customLineLabel(line), qty: line.qty,
    price: customUnitPrice(line.sizeId, line.ingredientIds),
    custom: { size: size ? size.name : '', ingredients: customLineIngredientNames(line) }
  };
}

// ---------- estoque que cada linha consome ----------
function customLineNeeds(line){
  const needs = {};
  const size = customSizeById(line.sizeId);
  if(!size) return needs;
  if(state.customSettings.doughId){
    needs[state.customSettings.doughId] = size.doughQty * line.qty;
  }
  for(const id of line.ingredientIds){
    const ing = ingredientById(id);
    if(!ing || !ing.customEnabled) continue;
    needs[id] = (needs[id] || 0) + ing.customPortion * size.factor * line.qty;
  }
  return needs;
}

// ---------- o que o cliente pode escolher ----------
function enabledCustomIngredients(){
  return state.ingredients.filter(i => i.customEnabled);
}

// O pastel personalizado tem condição de existir? (só olha o estoque, não a sacola)
function customStockAvailable(){
  if(!state.customSettings.active || state.customSizes.length === 0) return false;
  const ings = enabledCustomIngredients();
  if(ings.length === 0) return false;
  return state.customSizes.some(size => {
    const dough = state.customSettings.doughId ? ingredientById(state.customSettings.doughId) : null;
    if(state.customSettings.doughId && (!dough || dough.stock + STOCK_EPS < size.doughQty)) return false;
    return ings.some(ing => ing.customPortion <= 0 || ing.stock + STOCK_EPS >= ing.customPortion * size.factor);
  });
}

function customMinPrice(){
  if(state.customSizes.length === 0) return 0;
  return Math.min(...state.customSizes.map(s => s.basePrice));
}

// Um tamanho está disponível? (massa suficiente, considerando o que já está na sacola)
function builderSizeAvailable(sizeId){
  const test = { sizeId, ingredientIds: [], qty: 1 };
  return !cartExceedsStock(state.cart, [...state.customCart, test]);
}

// Dá pra incluir esse recheio no pastel que está sendo montado?
function builderIngredientBlocked(ingId){
  const d = state.builder;
  const ids = d.ingredientIds.includes(ingId) ? d.ingredientIds : [...d.ingredientIds, ingId];
  return cartExceedsStock(state.cart, [...state.customCart, { sizeId: d.sizeId, ingredientIds: ids, qty: d.qty }]);
}

function builderDraftLine(){
  const d = state.builder;
  return { sizeId: d.sizeId, ingredientIds: d.ingredientIds, qty: d.qty };
}
function builderDraftExceeds(){
  return cartExceedsStock(state.cart, [...state.customCart, builderDraftLine()]);
}

// Maior quantidade desse pastel que o estoque aguenta (0 se nem 1 cabe)
function builderMaxQty(){
  const d = state.builder;
  let max = 0;
  for(let q = 1; q <= 30; q++){
    const line = { sizeId: d.sizeId, ingredientIds: d.ingredientIds, qty: q };
    if(cartExceedsStock(state.cart, [...state.customCart, line])) break;
    max = q;
  }
  return max;
}
