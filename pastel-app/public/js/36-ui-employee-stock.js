// ============================================================
// EQUIPE: ABA ESTOQUE
//   Produtos     -> como cada item do cardápio baixa o estoque
//   Ingredientes -> o que você tem guardado (massa, carne, camarão...)
// ============================================================
const STOCK_UNITS = ['g', 'kg', 'ml', 'L', 'un'];

function empStockTab(){
  return `
    <div class="pill-row">
      <button class="pill ${state.stockView==='produtos'?'active':''}" onclick="setStockView('produtos')">Produtos</button>
      <button class="pill ${state.stockView==='ingredientes'?'active':''}" onclick="setStockView('ingredientes')">Ingredientes</button>
    </div>
    ${state.stockView === 'produtos' ? stockProductsView() : stockIngredientsView()}
  `;
}

function setStockView(v){
  playSoundEffect('pop');
  state.stockView = v;
  closeStockForms();
  render();
}
function closeStockForms(){
  state.addingIngredient = false;
  state.editingIngredientId = null;
  state.restocking = null;
  state.editingStockItemId = null;
  state.stockDraft = null;
}

// ------------------------------------------------------------
// PRODUTOS
// ------------------------------------------------------------
function stockProductsView(){
  return `
    <div class="info-banner">
      Escolha como cada produto baixa o estoque: <b>pastéis</b> usam <b>receita</b> (ingredientes),
      <b>bebidas de revenda</b> usam <b>estoque direto</b>. Quando não der mais pra fazer
      1 unidade, o item some do cardápio do cliente sozinho e volta quando você repor.
    </div>
    ${state.menu.length === 0 ? `<div class="muted" style="text-align:center; padding:20px;">Cadastre produtos na aba Cardápio primeiro.</div>` : ''}
    ${state.menu.map(item => state.editingStockItemId === item.id ? stockProductForm(item) : stockProductCard(item)).join('')}
  `;
}

function stockStatusBadge(item){
  const mode = item.stockMode || 'none';
  const gray = 'background:#F3F4F6; color:#6B7280;';
  if(mode === 'none') return `<span class="status-badge" style="${gray}">Sem controle</span>`;
  if(mode === 'recipe' && recipeLines(item.id).length === 0){
    return `<span class="status-badge" style="background:#FEF3C7; color:#D97706;">Receita vazia</span>`;
  }
  const n = maxProducible(item);
  const label = mode === 'direct' ? `Em estoque: ${fmtQty(n)}` : `Dá pra fazer: ${fmtQty(n)}`;
  let style = 'background:#DCFCE7; color:#16A34A;';
  if(n < 1) style = 'background:#FEE2E2; color:#DC2626;';
  else if(n <= 10) style = 'background:#FEF3C7; color:#D97706;';
  return `<span class="status-badge" style="${style}">${label}</span>`;
}

function stockProductCard(item){
  const mode = item.stockMode || 'none';
  const lines = recipeLines(item.id);
  const out = isOutOfStock(item);
  const restockOpen = state.restocking && state.restocking.kind === 'item' && state.restocking.id === item.id;
  const limiter = limitingIngredient(item);

  return `
    <div class="order-card-emp" style="${item.active===false?'opacity:0.6;':''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div style="font-weight:700;">${item.emoji || ''} ${escapeHtml(item.name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(item.cat)}</div>
        </div>
        ${stockStatusBadge(item)}
      </div>

      ${mode === 'recipe' && lines.length > 0 ? `
        <div class="muted" style="margin-top:8px;">
          <b>Receita (1 unidade):</b>
          ${lines.map(l => {
            const ing = ingredientById(l.ingredientId);
            return ing ? `${fmtQty(l.quantity)} ${ing.unit} de ${escapeHtml(ing.name)}` : '(ingrediente removido)';
          }).join(' • ')}
        </div>
        ${limiter && !out ? `<div class="muted" style="margin-top:4px;">Quem limita: <b>${escapeHtml(limiter.name)}</b></div>` : ''}
      ` : ''}

      ${out ? `<div class="stock-warn">Fora do cardápio até repor o estoque.</div>` : ''}

      ${restockOpen ? restockRowHtml() : ''}

      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px;">
        ${mode === 'direct' && !restockOpen ? `<button class="btn btn-outline btn-sm" onclick="startRestock('item','${item.id}')">+ Repor</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="startEditStock('${item.id}')">${mode === 'none' ? 'Controlar estoque' : 'Configurar'}</button>
      </div>
    </div>
  `;
}

function stockProductForm(item){
  const d = state.stockDraft;
  if(!d) return '';
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:10px;">Estoque de: ${escapeHtml(item.name)}</h4>
      <div class="field">
        <label>Como controlar?</label>
        <select id="sd-mode" onchange="setStockDraftMode(this.value)">
          <option value="none" ${d.mode==='none'?'selected':''}>Não controlar (sempre disponível)</option>
          <option value="recipe" ${d.mode==='recipe'?'selected':''}>Por receita — baixa ingredientes (pastéis)</option>
          <option value="direct" ${d.mode==='direct'?'selected':''}>Estoque direto — revenda (bebidas)</option>
        </select>
      </div>

      ${d.mode === 'recipe' ? recipeEditorHtml() : ''}

      ${d.mode === 'direct' ? `
        <div class="field">
          <label>Quantas unidades você tem agora?</label>
          <input id="sd-direct-qty" type="number" min="0" step="1" value="${d.qty}">
          <small class="muted" style="display:block; margin-top:4px;">Cada venda tira 1 unidade. Chegou a zero, o item sai do cardápio.</small>
        </div>
      ` : ''}

      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn btn-outline" onclick="cancelStockForm()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveStockForm()">Salvar</button>
      </div>
    </div>
  `;
}

function recipeEditorHtml(){
  const d = state.stockDraft;
  if(state.ingredients.length === 0){
    return `<div class="stock-warn" style="background:#FEF3C7; color:#92400E;">
      Você ainda não cadastrou nenhum ingrediente. Vá na aba <b>Ingredientes</b> (acima) e cadastre primeiro.
    </div>`;
  }
  return `
    <p class="muted" style="margin-bottom:8px;">Quanto de cada ingrediente vai em <b>1 unidade</b> deste produto:</p>
    ${d.lines.map((l, idx) => {
      const ing = ingredientById(l.ingredientId);
      return `
        <div class="recipe-line">
          <select id="sd-ing-${idx}" onchange="changeStockLineIngredient(${idx}, this.value)">
            ${state.ingredients.map(i => `<option value="${i.id}" ${i.id===l.ingredientId?'selected':''}>${escapeHtml(i.name)}</option>`).join('')}
          </select>
          <input id="sd-qty-${idx}" type="number" min="0" step="any" value="${l.quantity}" placeholder="qtd">
          <span class="unit">${ing ? ing.unit : ''}</span>
          <button class="btn-ghost" style="padding:4px 6px;" title="Remover" onclick="removeStockLine(${idx})">✕</button>
        </div>`;
    }).join('')}
    <button class="btn btn-outline btn-sm" onclick="addStockLine()">+ Adicionar ingrediente</button>
  `;
}

// guarda o que foi digitado antes de qualquer re-desenho do formulário
function syncStockDraftFromDom(){
  const d = state.stockDraft;
  if(!d) return;
  d.lines.forEach((l, idx) => {
    const sel = document.getElementById('sd-ing-' + idx);
    const qty = document.getElementById('sd-qty-' + idx);
    if(sel) l.ingredientId = sel.value;
    if(qty) l.quantity = qty.value;
  });
  const direct = document.getElementById('sd-direct-qty');
  if(direct) d.qty = direct.value;
}

function startEditStock(itemId){
  const item = state.menu.find(m => m.id === itemId);
  if(!item) return;
  const mode = item.stockMode || 'none';
  state.stockDraft = {
    mode,
    qty: mode === 'direct' ? item.stockQty : 0,
    lines: recipeLines(itemId).map(l => ({ ingredientId: l.ingredientId, quantity: l.quantity }))
  };
  state.editingStockItemId = itemId;
  state.restocking = null;
  render();
}
function cancelStockForm(){ closeStockForms(); render(); }

function setStockDraftMode(mode){
  syncStockDraftFromDom();
  const d = state.stockDraft;
  d.mode = mode;
  if(mode === 'recipe' && d.lines.length === 0 && state.ingredients.length > 0){
    d.lines.push({ ingredientId: state.ingredients[0].id, quantity: '' });
  }
  render();
}
function addStockLine(){
  syncStockDraftFromDom();
  const used = new Set(state.stockDraft.lines.map(l => l.ingredientId));
  const next = state.ingredients.find(i => !used.has(i.id)) || state.ingredients[0];
  state.stockDraft.lines.push({ ingredientId: next.id, quantity: '' });
  render();
}
function removeStockLine(idx){
  syncStockDraftFromDom();
  state.stockDraft.lines.splice(idx, 1);
  render();
}
function changeStockLineIngredient(idx, ingredientId){
  syncStockDraftFromDom();
  state.stockDraft.lines[idx].ingredientId = ingredientId;
  render();
}

async function saveStockForm(){
  syncStockDraftFromDom();
  const d = state.stockDraft;
  const itemId = state.editingStockItemId;
  if(!d || !itemId) return;

  let err = null;
  if(d.mode === 'recipe'){
    const merged = {}; // ingrediente repetido na receita? soma as quantidades
    for(const l of d.lines){
      const q = parseFloat(String(l.quantity).replace(',', '.'));
      if(!l.ingredientId || !(q > 0)){
        alert('Preencha a quantidade (maior que zero) de todos os ingredientes, ou remova a linha vazia.');
        return;
      }
      merged[l.ingredientId] = (merged[l.ingredientId] || 0) + q;
    }
    const lines = Object.entries(merged).map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
    if(lines.length === 0){ alert('Adicione pelo menos um ingrediente à receita.'); return; }
    err = await saveRecipeLines(itemId, lines);
    if(!err) err = await setItemStockConfig(itemId, 'recipe', 0);
  } else if(d.mode === 'direct'){
    const qty = Math.max(0, Math.floor(parseFloat(String(d.qty).replace(',', '.')) || 0));
    err = await saveRecipeLines(itemId, []); // limpa receita antiga, se houver
    if(!err) err = await setItemStockConfig(itemId, 'direct', qty);
  } else {
    err = await saveRecipeLines(itemId, []);
    if(!err) err = await setItemStockConfig(itemId, 'none', 0);
  }

  if(err){
    alert('Não foi possível salvar o estoque agora. Confira se rodou a migração do estoque no Supabase e tente de novo.');
    return;
  }
  closeStockForms();
  await loadStock();
  playSoundEffect('ding');
  render();
}

// ------------------------------------------------------------
// INGREDIENTES
// ------------------------------------------------------------
function stockIngredientsView(){
  return `
    <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="startAddIngredient()">+ Novo ingrediente</button>
    <p class="muted" style="margin-bottom:14px;">
      Ingredientes compartilhados (como a <b>massa</b>) são cadastrados <b>uma vez só</b> e entram na
      receita de cada sabor. Dica: use <b>g</b> para carnes/queijos e <b>un</b> para massa, ovos etc.
    </p>

    ${state.addingIngredient ? ingredientForm(null) : ''}

    ${state.ingredients.length === 0 && !state.addingIngredient ? `
      <div class="muted" style="text-align:center; padding:24px 10px;">
        Nenhum ingrediente ainda.<br>Exemplo: "Massa de pastel" — 100 un · "Carne moída" — 6000 g.
      </div>` : ''}

    ${state.ingredients.map(ing => state.editingIngredientId === ing.id ? ingredientForm(ing) : ingredientCard(ing)).join('')}
  `;
}

function ingredientUsedBy(ingId){
  const ids = new Set(state.recipes.filter(r => r.ingredientId === ingId).map(r => r.menuItemId));
  return state.menu.filter(m => ids.has(m.id)).map(m => m.name);
}

function ingredientCard(ing){
  const usedBy = ingredientUsedBy(ing.id);
  const restockOpen = state.restocking && state.restocking.kind === 'ingredient' && state.restocking.id === ing.id;
  const empty = ing.stock <= 0;
  return `
    <div class="order-card-emp">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div style="font-weight:700;">${escapeHtml(ing.name)}</div>
        <span class="status-badge" style="${empty ? 'background:#FEE2E2; color:#DC2626;' : 'background:#F3F4F6; color:#1F2937;'}">
          ${fmtQty(ing.stock)} ${ing.unit}
        </span>
      </div>
      <div class="muted" style="margin-top:6px;">
        ${usedBy.length > 0 ? `Usado em: ${usedBy.map(escapeHtml).join(', ')}` : 'Ainda não usado em nenhuma receita.'}
      </div>
      ${restockOpen ? restockRowHtml() : ''}
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px;">
        ${!restockOpen ? `<button class="btn btn-outline btn-sm" onclick="startRestock('ingredient','${ing.id}')">+ Repor</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="state.editingIngredientId='${ing.id}'; state.addingIngredient=false; state.restocking=null; render();">Editar</button>
        <button class="btn btn-sm" style="background:var(--brand-red); color:#FFF;" onclick="deleteIngredient('${ing.id}')">Excluir</button>
      </div>
    </div>
  `;
}

function ingredientForm(ing){
  const f = ing || { name:'', unit:'g', stock:0 };
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:10px;">${ing ? 'Editar ingrediente' : 'Novo ingrediente'}</h4>
      <div class="field"><label>Nome</label><input id="ig-name" value="${escapeHtml(f.name)}" placeholder="Ex: Camarão"></div>
      <div class="field">
        <label>Unidade</label>
        <select id="ig-unit">
          ${STOCK_UNITS.map(u => `<option value="${u}" ${u===f.unit?'selected':''}>${u}</option>`).join('')}
        </select>
        ${ing ? `<small class="muted" style="display:block; margin-top:4px;">Se mudar a unidade, revise as receitas que usam este ingrediente.</small>` : ''}
      </div>
      <div class="field">
        <label>${ing ? 'Quantidade em estoque agora (corrige o total)' : 'Quantidade em estoque'}</label>
        <input id="ig-stock" type="number" min="0" step="any" value="${f.stock}">
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" onclick="cancelIngredientForm()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveIngredientForm('${ing ? ing.id : ''}')">Salvar</button>
      </div>
    </div>
  `;
}

function startAddIngredient(){
  closeStockForms();
  state.addingIngredient = true;
  render();
}
function cancelIngredientForm(){ closeStockForms(); render(); }

async function saveIngredientForm(id){
  const name = document.getElementById('ig-name').value.trim();
  const unit = document.getElementById('ig-unit').value;
  const stock = Math.max(0, parseFloat(String(document.getElementById('ig-stock').value).replace(',', '.')) || 0);
  if(!name){ alert('Dê um nome ao ingrediente.'); return; }

  const ing = { id: id || 'i' + Date.now().toString(36), name, unit, stock };
  const err = await saveIngredient(ing);
  if(err){
    alert('Não foi possível salvar o ingrediente. Confira se rodou a migração do estoque no Supabase.');
    return;
  }
  closeStockForms();
  await loadIngredientsAndRecipes();
  playSoundEffect('ding');
  render();
}

async function deleteIngredient(id){
  const usedBy = ingredientUsedBy(id);
  if(usedBy.length > 0){
    alert('Esse ingrediente está em receitas (' + usedBy.join(', ') + '). Tire ele dessas receitas antes de excluir.');
    return;
  }
  if(!confirm('Excluir este ingrediente?')) return;
  const err = await deleteIngredientRemote(id);
  if(err){ alert('Não foi possível excluir agora.'); return; }
  state.ingredients = state.ingredients.filter(i => i.id !== id);
  render();
}

// ------------------------------------------------------------
// REPOR ESTOQUE (soma, em vez de sobrescrever — seguro mesmo com pedidos chegando)
// ------------------------------------------------------------
function restockRowHtml(){
  return `
    <div class="restock-row">
      <input id="restock-input" type="number" min="0" step="any" placeholder="Quanto você está adicionando?">
      <button class="btn btn-primary btn-sm" onclick="confirmRestock()">Adicionar</button>
      <button class="btn btn-outline btn-sm" onclick="cancelRestock()">Cancelar</button>
    </div>
  `;
}
function startRestock(kind, id){
  closeStockForms();
  state.restocking = { kind, id };
  render();
}
function cancelRestock(){ state.restocking = null; render(); }

async function confirmRestock(){
  const r = state.restocking;
  if(!r) return;
  const amount = parseFloat(String(document.getElementById('restock-input').value).replace(',', '.'));
  if(!(amount > 0)){ alert('Digite uma quantidade maior que zero.'); return; }
  const err = await adjustStockRemote(r.kind, r.id, amount);
  if(err){ alert('Não foi possível repor agora. Confira se rodou a migração do estoque no Supabase.'); return; }
  state.restocking = null;
  await loadStock();
  playSoundEffect('ding');
  render();
}
