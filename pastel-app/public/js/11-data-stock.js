// ============================================================
// DADOS: ESTOQUE (ingredientes, receitas e produtos de revenda)
// ============================================================
// Como funciona:
//  - Cada produto do cardápio tem um "modo de estoque":
//      'none'   -> não controla (sempre disponível)   <- padrão
//      'recipe' -> baixa ingredientes pela receita     (pastéis)
//      'direct' -> baixa unidades do próprio produto   (bebidas de revenda)
//  - Se não dá mais pra produzir 1 unidade, o item some do cardápio do
//    cliente até o estoque voltar.
//  - A baixa acontece dentro do banco (função consume_stock), numa
//    transação só, então dois clientes pedindo ao mesmo tempo nunca
//    vendem a mesma última unidade duas vezes.

const STOCK_EPS = 1e-9;

// ---------- carregar / salvar ----------
function rowToIngredient(row){
  return { id: row.id, name: row.name, unit: row.unit || 'g', stock: Number(row.stock) };
}
function rowToRecipeLine(row){
  return { menuItemId: row.menu_item_id, ingredientId: row.ingredient_id, quantity: Number(row.quantity) };
}

async function loadIngredientsAndRecipes(){
  try{
    const [ing, rec] = await Promise.all([
      supabaseClient.from('ingredients').select('*').order('name'),
      supabaseClient.from('recipe_items').select('*')
    ]);
    if(ing.error) throw ing.error;
    if(rec.error) throw rec.error;
    state.ingredients = (ing.data || []).map(rowToIngredient);
    state.recipes = (rec.data || []).map(rowToRecipeLine);
  }catch(e){
    console.warn('Estoque indisponível (rodou a migração migration-estoque.sql?)', e);
    state.ingredients = [];
    state.recipes = [];
  }
}

// Recarrega cardápio (modo/quantidade de revenda) + ingredientes + receitas
async function loadStock(){
  await loadMenu();
  await loadIngredientsAndRecipes();
}

async function saveIngredient(ing){
  const { error } = await supabaseClient.from('ingredients')
    .upsert({ id: ing.id, name: ing.name, unit: ing.unit, stock: ing.stock });
  if(error) console.error('Falha ao salvar ingrediente', error);
  return error || null;
}

async function deleteIngredientRemote(id){
  const { error } = await supabaseClient.from('ingredients').delete().eq('id', id);
  if(error) console.error('Falha ao excluir ingrediente', error);
  return error || null;
}

// kind: 'ingredient' | 'item'. delta positivo = repor, negativo = tirar.
async function adjustStockRemote(kind, id, delta){
  const { error } = await supabaseClient.rpc('adjust_stock', { p_kind: kind, p_id: id, p_delta: delta });
  if(error) console.error('Falha ao ajustar estoque', error);
  return error || null;
}

async function setItemStockConfig(itemId, mode, qty){
  const { error } = await supabaseClient.from('menu_items')
    .update({ stock_mode: mode, stock_qty: qty }).eq('id', itemId);
  if(error) console.error('Falha ao salvar modo de estoque do item', error);
  return error || null;
}

// lines: [{ingredientId, quantity}] já validadas (sem repetição). [] = limpa a receita.
async function saveRecipeLines(itemId, lines){
  if(lines.length > 0){
    const rows = lines.map(l => ({ menu_item_id: itemId, ingredient_id: l.ingredientId, quantity: l.quantity }));
    const { error } = await supabaseClient.from('recipe_items')
      .upsert(rows, { onConflict: 'menu_item_id,ingredient_id' });
    if(error){ console.error('Falha ao salvar receita', error); return error; }
  }
  let del = supabaseClient.from('recipe_items').delete().eq('menu_item_id', itemId);
  if(lines.length > 0){
    const keep = lines.map(l => `"${l.ingredientId}"`).join(',');
    del = del.not('ingredient_id', 'in', `(${keep})`);
  }
  const { error: delErr } = await del;
  if(delErr){ console.error('Falha ao limpar linhas antigas da receita', delErr); return delErr; }

  state.recipes = state.recipes.filter(r => r.menuItemId !== itemId)
    .concat(lines.map(l => ({ menuItemId: itemId, ingredientId: l.ingredientId, quantity: l.quantity })));
  return null;
}

// ---------- baixa de estoque no pedido ----------
function itemIsTracked(item){ return (item.stockMode || 'none') !== 'none'; }

// items = cartItems() ({id, qty, stockMode, ...}). Devolve null se deu certo.
async function consumeStock(items){
  if(!items.some(itemIsTracked)) return null; // nada controlado: não mexe no estoque
  const { error } = await supabaseClient.rpc('consume_stock', {
    p_items: items.map(i => ({ id: i.id, qty: i.qty }))
  });
  return error || null;
}
async function restoreStock(items){
  if(!items.some(itemIsTracked)) return;
  const { error } = await supabaseClient.rpc('restore_stock', {
    p_items: items.map(i => ({ id: i.id, qty: i.qty }))
  });
  if(error) console.error('Falha ao devolver estoque', error);
}
function isStockShortage(error){
  return !!(error && /ESTOQUE_INSUFICIENTE/.test(error.message || ''));
}

// ---------- disponibilidade ----------
function recipeLines(itemId){
  return state.recipes.filter(r => r.menuItemId === itemId);
}
function ingredientById(id){
  return state.ingredients.find(i => i.id === id);
}

// Quantas unidades dá pra fazer/vender agora (Infinity = sem controle)
function maxProducible(item){
  const mode = item.stockMode || 'none';
  if(mode === 'direct') return Math.max(0, Math.floor(Number(item.stockQty || 0) + STOCK_EPS));
  if(mode === 'recipe'){
    const lines = recipeLines(item.id);
    if(lines.length === 0) return Infinity; // receita ainda vazia: não trava a venda
    let min = Infinity;
    for(const l of lines){
      const ing = ingredientById(l.ingredientId);
      if(!ing) return 0;
      if(l.quantity <= 0) continue;
      min = Math.min(min, Math.floor(ing.stock / l.quantity + STOCK_EPS));
    }
    return Math.max(0, min);
  }
  return Infinity;
}

// Qual ingrediente está limitando a produção desse item (pra mostrar pra equipe)
function limitingIngredient(item){
  if((item.stockMode || 'none') !== 'recipe') return null;
  let best = null, bestN = Infinity;
  for(const l of recipeLines(item.id)){
    const ing = ingredientById(l.ingredientId);
    if(!ing || l.quantity <= 0) continue;
    const n = Math.floor(ing.stock / l.quantity + STOCK_EPS);
    if(n < bestN){ bestN = n; best = ing; }
  }
  return best;
}

function isOutOfStock(item){
  return itemIsTracked(item) && maxProducible(item) < 1;
}

// Itens que o cliente pode ver no cardápio
function visibleMenuItems(){
  return state.menu.filter(m => m.active !== false && !isOutOfStock(m));
}

// Quanto cada ingrediente é consumido por uma sacola (e quais itens de revenda passam do limite)
function cartStockUsage(cartMap){
  const ingredientUse = {};
  const directOver = [];
  for(const [id, qty] of Object.entries(cartMap)){
    if(!(qty > 0)) continue;
    const item = state.menu.find(m => m.id === id);
    if(!item) continue;
    const mode = item.stockMode || 'none';
    if(mode === 'direct'){
      if(qty > Math.floor(Number(item.stockQty || 0) + STOCK_EPS)) directOver.push(id);
    } else if(mode === 'recipe'){
      for(const l of recipeLines(id)){
        ingredientUse[l.ingredientId] = (ingredientUse[l.ingredientId] || 0) + l.quantity * qty;
      }
    }
  }
  return { ingredientUse, directOver };
}

function overusedIngredientIds(cartMap){
  const { ingredientUse } = cartStockUsage(cartMap);
  const bad = new Set();
  for(const [ingId, need] of Object.entries(ingredientUse)){
    const ing = ingredientById(ingId);
    if(!ing || need > ing.stock + STOCK_EPS) bad.add(ingId);
  }
  return bad;
}

function cartExceedsStock(cartMap){
  const { directOver } = cartStockUsage(cartMap);
  return directOver.length > 0 || overusedIngredientIds(cartMap).size > 0;
}

// Dá pra colocar mais 1 unidade desse item na sacola sem estourar o estoque?
function canAddOne(itemId){
  const test = { ...state.cart };
  test[itemId] = (test[itemId] || 0) + 1;
  return !cartExceedsStock(test);
}

// Ajusta a sacola do cliente quando o estoque mudou (item acabou, outro cliente comprou...)
// Devolve true se mudou alguma coisa.
function clampCartToStock(){
  let changed = false;

  // 1) itens de revenda e itens que sumiram do cardápio
  for(const id of Object.keys(state.cart)){
    const item = state.menu.find(m => m.id === id);
    if(!item || item.active === false){ delete state.cart[id]; changed = true; continue; }
    if((item.stockMode || 'none') === 'direct'){
      const max = Math.max(0, Math.floor(Number(item.stockQty || 0) + STOCK_EPS));
      if(state.cart[id] > max){ state.cart[id] = max; changed = true; }
    }
    if(state.cart[id] <= 0) delete state.cart[id];
  }

  // 2) itens de receita: reduz quem usa algum ingrediente em falta
  let guard = 1000;
  while(guard-- > 0){
    const bad = overusedIngredientIds(state.cart);
    if(bad.size === 0) break;
    let target = null;
    for(const [id, qty] of Object.entries(state.cart)){
      const item = state.menu.find(m => m.id === id);
      if(!item || (item.stockMode || 'none') !== 'recipe') continue;
      if(!recipeLines(id).some(l => bad.has(l.ingredientId))) continue;
      if(target === null || qty > state.cart[target]) target = id;
    }
    if(target === null) break;
    state.cart[target] -= 1;
    changed = true;
    if(state.cart[target] <= 0) delete state.cart[target];
  }
  return changed;
}

// Atualiza o estoque em segundo plano (cliente navegando) e reajusta a sacola
async function refreshStockInBackground(){
  await loadStock();
  const changed = clampCartToStock();
  if(state.view === 'customer' || state.view === 'meus-pedidos') render();
  if(changed) showToast('Alguns itens esgotaram e foram ajustados na sua sacola.');
}
