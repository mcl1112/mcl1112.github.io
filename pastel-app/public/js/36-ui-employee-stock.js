// ============================================================
// EQUIPE: ABA ESTOQUE
//   Produtos       -> como cada item do cardápio baixa o estoque
//   Ingredientes   -> o que você tem guardado (massa, carne, camarão...)
//   Personalizado  -> pastel que o cliente monta (ver 37-ui-employee-stock-custom.js)
// ============================================================
const STOCK_UNITS = ['g', 'kg', 'ml', 'L', 'un'];

function empStockTab(){
  const v = state.stockView;
  return `
    ${stockSummaryHtml()}
    <div class="seg">
      <button class="seg-btn ${v==='produtos'?'active':''}" onclick="setStockView('produtos')"><span>🥟</span>Produtos</button>
      <button class="seg-btn ${v==='ingredientes'?'active':''}" onclick="setStockView('ingredientes')"><span>🧂</span>Ingredientes</button>
      <button class="seg-btn ${v==='personalizado'?'active':''}" onclick="setStockView('personalizado')"><span>🧑‍🍳</span>Personalizado</button>
    </div>
    ${v === 'produtos' ? stockProductsView() : v === 'ingredientes' ? stockIngredientsView() : stockCustomView()}
  `;
}

function setStockView(v){
  playSoundEffect('pop');
  state.stockView = v;
  state.stockSearch = '';
  closeStockForms();
  render();
}
function closeStockForms(){
  state.addingIngredient = false;
  state.editingIngredientId = null;
  state.restocking = null;
  state.editingStockItemId = null;
  state.stockDraft = null;
  state.editingCustomIngId = null;
  state.editingSizes = false;
  state.sizesDraft = null;
}

// ------------------------------------------------------------
// NÍVEIS (cores e barrinhas)
// ------------------------------------------------------------
// n = quantas unidades/pastéis ainda dá pra fazer. null = sem referência.
function levelOf(n){
  if(n === null || n === undefined) return { tone: 'none', pct: 0 };
  if(n < 1) return { tone: 'out', pct: 3 };
  const pct = Math.min(100, Math.max(6, n));
  return { tone: n <= 10 ? 'low' : 'ok', pct };
}
function barHtml(level){
  if(level.tone === 'none' || level.tone === 'warn') return '';
  return `<div class="bar"><i class="bar-fill ${level.tone}" style="width:${level.pct}%"></i></div>`;
}

function mediumSize(){
  if(state.customSizes.length === 0) return null;
  return [...state.customSizes].sort((a, b) => Math.abs(a.factor - 1) - Math.abs(b.factor - 1))[0];
}

// Quantos pastéis dá pra fazer só com esse ingrediente (estimativa; null = não dá pra saber)
function ingredientServings(ing){
  const bases = [];
  if(ing.customEnabled && ing.customPortion > 0) bases.push(ing.customPortion);
  state.recipes.filter(r => r.ingredientId === ing.id).forEach(r => bases.push(r.quantity));
  if(ing.id === state.customSettings.doughId && mediumSize()) bases.push(mediumSize().doughQty);
  const basis = Math.max(0, ...bases);
  if(!(basis > 0)) return null;
  return Math.floor(ing.stock / basis + STOCK_EPS);
}
function ingredientLevel(ing){
  const n = ingredientServings(ing);
  if(n !== null) return levelOf(n);
  return ing.stock <= 0 ? { tone: 'out', pct: 3 } : { tone: 'none', pct: 0 };
}

function matchesSearch(name){
  const q = String(state.stockSearch || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if(!q) return true;
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q);
}
function onStockSearch(el){
  const pos = el.selectionStart;
  state.stockSearch = el.value;
  render();
  const again = document.getElementById('stock-search');
  if(again){ again.focus(); try{ again.setSelectionRange(pos, pos); }catch(e){} }
}
function searchBoxHtml(placeholder){
  return `<input id="stock-search" class="search" type="search" placeholder="${placeholder}"
            value="${escapeHtml(state.stockSearch)}" oninput="onStockSearch(this)">`;
}

// ------------------------------------------------------------
// RESUMO NO TOPO
// ------------------------------------------------------------
function stockSummaryHtml(){
  let out = 0, low = 0;
  state.ingredients.forEach(ing => {
    const t = ingredientLevel(ing).tone;
    if(t === 'out') out++; else if(t === 'low') low++;
  });
  state.menu.filter(m => m.active !== false).forEach(m => {
    if(!itemIsTracked(m)) return;
    const n = maxProducible(m);
    if(n < 1) out++; else if(isFinite(n) && n <= 10) low++;
  });
  const selling = visibleMenuItems().length;
  const total = state.menu.filter(m => m.active !== false).length;
  return `
    <div class="stat-row">
      <div class="stat-tile ${out > 0 ? 'tone-out' : ''}">
        <div class="stat-num">${out}</div><div class="stat-label">⛔ Em falta</div>
      </div>
      <div class="stat-tile ${low > 0 ? 'tone-low' : ''}">
        <div class="stat-num">${low}</div><div class="stat-label">⚠️ Acabando</div>
      </div>
      <div class="stat-tile tone-ok">
        <div class="stat-num">${selling}<small>/${total}</small></div><div class="stat-label">✅ No cardápio</div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// PRODUTOS
// ------------------------------------------------------------
function stockProductsView(){
  const items = state.menu.filter(m => matchesSearch(m.name));
  const cats = [...new Set(items.map(m => m.cat))];
  return `
    <div class="info-banner">
      <b>Pastéis prontos e bebidas</b>: use <b>Estoque direto</b> — cada venda tira 1 unidade, igual à Coca.
      Quando chegar a zero, o item some do cardápio do cliente sozinho e volta quando você repor.
      (O pastel que o cliente monta é configurado na aba <b>Personalizado</b>.)
    </div>
    ${searchBoxHtml('Buscar produto...')}
    ${state.menu.length === 0 ? `<div class="muted" style="text-align:center; padding:20px;">Cadastre produtos na aba Cardápio primeiro.</div>` : ''}
    ${cats.map(cat => `
      <div class="s-group">${escapeHtml(cat)} <span>${items.filter(m => m.cat === cat).length}</span></div>
      ${items.filter(m => m.cat === cat).map(item => state.editingStockItemId === item.id ? stockProductForm(item) : stockProductCard(item)).join('')}
    `).join('')}
  `;
}

function stockProductCard(item){
  const mode = item.stockMode || 'none';
  const lines = recipeLines(item.id);
  const out = isOutOfStock(item);
  const n = mode === 'none' ? null : maxProducible(item);
  const recipeEmpty = mode === 'recipe' && lines.length === 0;
  const lv = (n !== null && isFinite(n)) ? levelOf(n) : { tone: recipeEmpty ? 'warn' : 'none', pct: 0 };
  const restockOpen = state.restocking && state.restocking.kind === 'item' && state.restocking.id === item.id;
  const limiter = limitingIngredient(item);

  let qtyLine = '<span class="s-sub">Sem controle de estoque</span>';
  if(mode === 'direct') qtyLine = `<b>${fmtQty(n)}</b> em estoque`;
  if(mode === 'recipe') qtyLine = recipeEmpty
    ? '<span class="s-sub">Receita vazia — adicione os ingredientes</span>'
    : `Dá pra fazer <b>${fmtQty(n)}</b>`;

  return `
    <div class="s-card tone-${lv.tone}" style="${item.active===false?'opacity:0.6;':''}">
      <div class="s-icon">${item.emoji || '🥟'}</div>
      <div class="s-main">
        <div class="s-title">${escapeHtml(item.name)}</div>
        <div class="s-qty">${qtyLine}</div>
        ${barHtml(lv)}
        ${mode === 'recipe' && lines.length > 0 ? `
          <div class="muted" style="margin-top:6px;">
            ${lines.map(l => { const ing = ingredientById(l.ingredientId);
              return ing ? `${ingredientEmoji(ing.name)} ${fmtQty(l.quantity)} ${ing.unit} ${escapeHtml(ing.name)}` : '(ingrediente removido)'; }).join(' · ')}
            ${limiter && !out ? `<br>Quem limita: <b>${escapeHtml(limiter.name)}</b>` : ''}
          </div>` : ''}
        ${out ? `<div class="stock-warn">Fora do cardápio até repor o estoque.</div>` : ''}
        ${restockOpen ? restockRowHtml('un', true) : ''}
        <div class="s-actions">
          ${mode === 'direct' && !restockOpen ? `<button class="btn btn-primary btn-sm" onclick="startRestock('item','${item.id}')">+ Repor</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="startEditStock('${item.id}')">${mode === 'none' ? 'Controlar estoque' : 'Configurar'}</button>
        </div>
      </div>
    </div>
  `;
}

function stockProductForm(item){
  const d = state.stockDraft;
  if(!d) return '';
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:10px;">${item.emoji || ''} Estoque de: ${escapeHtml(item.name)}</h4>
      <div class="field">
        <label>Como controlar?</label>
        <select id="sd-mode" onchange="setStockDraftMode(this.value)">
          <option value="none" ${d.mode==='none'?'selected':''}>Não controlar (sempre disponível)</option>
          <option value="direct" ${d.mode==='direct'?'selected':''}>Estoque direto — pastéis prontos e bebidas</option>
          <option value="recipe" ${d.mode==='recipe'?'selected':''}>Por receita — feito na hora com ingredientes fixos</option>
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
  const rank = { out: 0, low: 1, none: 2, ok: 3, warn: 2 };
  const list = state.ingredients
    .filter(i => matchesSearch(i.name))
    .sort((a, b) => rank[ingredientLevel(a).tone] - rank[ingredientLevel(b).tone] || a.name.localeCompare(b.name, 'pt-BR'));
  return `
    <button class="btn btn-primary btn-block" style="margin-bottom:10px;" onclick="startAddIngredient()">+ Novo ingrediente</button>
    <p class="muted" style="margin-bottom:12px;">
      O que está <b>em falta</b> ou <b>acabando</b> aparece primeiro. Ingredientes compartilhados (como a
      <b>massa</b>) são cadastrados <b>uma vez só</b>. Dica: use <b>g</b> para carnes/queijos e <b>un</b> para massa e ovos.
    </p>
    ${searchBoxHtml('Buscar ingrediente...')}

    ${state.addingIngredient ? ingredientForm(null) : ''}

    ${state.ingredients.length === 0 && !state.addingIngredient ? `
      <div class="muted" style="text-align:center; padding:24px 10px;">
        Nenhum ingrediente ainda.<br>Exemplo: "Massa de pastel" — 100 un · "Carne moída" — 6000 g.
      </div>` : ''}

    ${list.map(ing => state.editingIngredientId === ing.id ? ingredientForm(ing) : ingredientCard(ing)).join('')}
  `;
}

function ingredientUsedBy(ingId){
  const ids = new Set(state.recipes.filter(r => r.ingredientId === ingId).map(r => r.menuItemId));
  return state.menu.filter(m => ids.has(m.id)).map(m => m.name);
}

function ingredientCard(ing){
  const usedBy = ingredientUsedBy(ing.id);
  const servings = ingredientServings(ing);
  const lv = ingredientLevel(ing);
  const restockOpen = state.restocking && state.restocking.kind === 'ingredient' && state.restocking.id === ing.id;
  return `
    <div class="s-card tone-${lv.tone}">
      <div class="s-icon">${ingredientEmoji(ing.name)}</div>
      <div class="s-main">
        <div class="s-title">
          ${escapeHtml(ing.name)}
          ${ing.id === state.customSettings.doughId ? '<span class="s-tag">massa</span>' : ''}
          ${ing.customEnabled ? '<span class="s-tag ok">no personalizado</span>' : ''}
        </div>
        <div class="s-qty">
          <b>${fmtQty(ing.stock)}</b> ${ing.unit}
          ${servings !== null ? `<span class="s-sub">· dá pra ~${fmtQty(servings)} pastéis</span>` : ''}
        </div>
        ${barHtml(lv)}
        ${usedBy.length > 0 ? `<div class="muted" style="margin-top:6px;">Receitas: ${usedBy.map(escapeHtml).join(', ')}</div>` : ''}
        ${restockOpen ? restockRowHtml(ing.unit, false) : ''}
        <div class="s-actions">
          ${!restockOpen ? `<button class="btn btn-primary btn-sm" onclick="startRestock('ingredient','${ing.id}')">+ Repor</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="state.editingIngredientId='${ing.id}'; state.addingIngredient=false; state.restocking=null; render();">Editar</button>
          <button class="btn btn-sm" style="background:var(--brand-red); color:#FFF;" onclick="deleteIngredient('${ing.id}')">Excluir</button>
        </div>
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
        ${ing ? `<small class="muted" style="display:block; margin-top:4px;">Se mudar a unidade, revise as receitas e o pastel personalizado.</small>` : ''}
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
// REPOR / RETIRAR (soma ou subtrai, em vez de sobrescrever — seguro mesmo com pedidos chegando)
// ------------------------------------------------------------
function restockChips(unit, isProduct){
  if(isProduct) return [10, 24, 50];
  return ({ g: [100, 500, 1000], kg: [1, 5, 10], ml: [250, 500, 1000], L: [1, 5, 10], un: [10, 50, 100] })[unit] || [10, 50, 100];
}
function restockRowHtml(unit, isProduct){
  return `
    <div class="restock-box">
      <div class="restock-chips">
        ${restockChips(unit, isProduct).map(n => `<button class="chip-mini" onclick="setRestockValue(${n})">${fmtQty(n)}</button>`).join('')}
      </div>
      <div class="restock-row">
        <input id="restock-input" type="number" min="0" step="any" placeholder="Quantidade">
        <button class="btn btn-primary btn-sm" onclick="confirmRestock(1)">Adicionar</button>
        <button class="btn btn-outline btn-sm" onclick="confirmRestock(-1)">Retirar</button>
        <button class="btn-ghost" title="Cancelar" onclick="cancelRestock()">✕</button>
      </div>
    </div>
  `;
}
function setRestockValue(n){
  const el = document.getElementById('restock-input');
  if(el){ el.value = n; el.focus(); }
}
function startRestock(kind, id){
  closeStockForms();
  state.restocking = { kind, id };
  render();
}
function cancelRestock(){ state.restocking = null; render(); }

// sign = 1 repõe, -1 retira (perda, estrago...)
async function confirmRestock(sign){
  const r = state.restocking;
  if(!r) return;
  const amount = parseFloat(String(document.getElementById('restock-input').value).replace(',', '.'));
  if(!(amount > 0)){ alert('Digite uma quantidade maior que zero.'); return; }
  const err = await adjustStockRemote(r.kind, r.id, amount * (sign < 0 ? -1 : 1));
  if(err){ alert('Não foi possível ajustar agora. Confira se rodou a migração do estoque no Supabase.'); return; }
  state.restocking = null;
  await loadStock();
  playSoundEffect('ding');
  render();
}
