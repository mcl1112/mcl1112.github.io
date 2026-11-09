// ============================================================
// EQUIPE: ESTOQUE > PERSONALIZADO
// Configura o pastel que o cliente monta: tamanhos, massa e quais
// ingredientes ele pode escolher (com porção e adicional de preço).
// ============================================================

function stockCustomView(){
  const s = state.customSettings;
  const hasSizes = state.customSizes.length > 0;
  const list = state.ingredients
    .filter(i => matchesSearch(i.name))
    .sort((a, b) => (Number(b.customEnabled) - Number(a.customEnabled)) || a.name.localeCompare(b.name, 'pt-BR'));
  const enabled = enabledCustomIngredients().length;
  const visible = customStockAvailable();

  return `
    <div class="info-banner">
      <b>Pastel personalizado</b>: o cliente escolhe o <b>tamanho</b> (P/M/G) e <b>quantas porções</b> de cada recheio
      (ex.: 1 fatia de queijo = 25 g, 2 fatias = 50 g). Cada porção baixa do estoque o peso que você definir.
      Preço = preço do tamanho + preço de cada porção. Recheio sem estoque some da montagem sozinho.
    </div>

    ${!hasSizes ? `
      <div class="ticket-card" style="text-align:center;">
        <div style="font-size:34px;">🧑‍🍳</div>
        <h4 style="margin:6px 0;">Ainda não há tamanhos</h4>
        <p class="muted" style="margin-bottom:12px;">
          Crie os tamanhos padrão (Pequeno, Médio e Grande) e depois ajuste preços e porções.
          Se aparecer erro, rode o <b>migration-personalizado.sql</b> no Supabase.
        </p>
        <button class="btn btn-primary" onclick="createDefaultSizes()">Criar tamanhos padrão</button>
      </div>
    ` : `
      <div class="s-card tone-${s.active ? (visible ? 'ok' : 'warn') : 'none'}">
        <div class="s-icon">🧑‍🍳</div>
        <div class="s-main">
          <div class="s-title">Pastel personalizado ${s.active ? '<span class="s-tag ok">ligado</span>' : '<span class="s-tag">desligado</span>'}</div>
          <div class="s-qty"><span class="s-sub">${
            !s.active ? 'Não aparece para o cliente.'
            : visible ? 'Aparece para o cliente no cardápio.'
            : 'Ligado, mas ainda não aparece: falta estoque de massa ou de algum recheio.'
          }</span></div>
          <div class="s-actions">
            <button class="btn ${s.active ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="toggleCustomActive()">${s.active ? 'Desligar' : 'Ligar'}</button>
          </div>
        </div>
      </div>

      <div class="ticket-card">
        <h4 style="margin-bottom:6px;">Massa</h4>
        <p class="muted" style="margin-bottom:8px;">Qual ingrediente é a massa? Cada tamanho gasta uma quantidade dela.</p>
        <select id="cs-dough" class="plain-select" onchange="changeDough(this.value)">
          <option value="">— não controlar a massa —</option>
          ${state.ingredients.map(i => `<option value="${i.id}" ${i.id === s.doughId ? 'selected' : ''}>${escapeHtml(i.name)} (${i.unit})</option>`).join('')}
        </select>
      </div>

      ${state.editingSizes ? sizesFormHtml() : sizesCardHtml()}

      <div class="s-group">Recheios que o cliente pode escolher <span>${enabled}</span></div>
      ${searchBoxHtml('Buscar ingrediente...')}
      ${state.ingredients.length === 0 ? `<div class="muted" style="text-align:center; padding:20px;">Cadastre ingredientes na aba <b>Ingredientes</b> primeiro.</div>` : ''}
      ${list.map(ing => state.editingCustomIngId === ing.id ? customIngredientForm(ing) : customIngredientCard(ing)).join('')}
    `}
  `;
}

// ---------- ligar/desligar e massa ----------
async function toggleCustomActive(){
  const next = { ...state.customSettings, active: !state.customSettings.active };
  const err = await saveCustomSettings(next);
  if(err){ alert('Não foi possível salvar agora. Confira se rodou o migration-personalizado.sql no Supabase.'); return; }
  state.customSettings = next;
  playSoundEffect('ding');
  render();
}
async function changeDough(value){
  const next = { ...state.customSettings, doughId: value || null };
  const err = await saveCustomSettings(next);
  if(err){ alert('Não foi possível salvar agora.'); return; }
  state.customSettings = next;
  playSoundEffect('ding');
  render();
}

// ---------- tamanhos ----------
function sizesCardHtml(){
  return `
    <div class="ticket-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4>Tamanhos</h4>
        <button class="btn btn-outline btn-sm" onclick="startEditSizes()">Editar</button>
      </div>
      ${state.customSizes.map(sz => `
        <div class="size-row">
          <div class="size-row-name">${escapeHtml(sz.name)}</div>
          <div class="size-row-info">
            base <b>${money(sz.basePrice)}</b> · ${sz.maxPortions > 0 ? 'até <b>' + sz.maxPortions + '</b> porções' : 'sem limite de porções'} · massa ${fmtQty(sz.doughQty)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function sizesFormHtml(){
  const draft = state.sizesDraft || [];
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:6px;">Editar tamanhos</h4>
      <p class="muted" style="margin-bottom:10px;">
        <b>Preço base</b>: valor do pastel antes dos recheios. <b>Máx. de porções</b>: quantas porções de recheio
        (somando todos os ingredientes) cabem nesse tamanho — 0 = sem limite. <b>Massa</b>: quanto da massa o tamanho gasta.
      </p>
      ${draft.map((sz, idx) => `
        <div class="size-form">
          <div class="field"><label>Nome</label><input id="sz-name-${idx}" value="${escapeHtml(sz.name)}"></div>
          <div class="size-form-row">
            <div class="field"><label>Preço base (R$)</label><input id="sz-price-${idx}" type="number" min="0" step="0.10" value="${sz.basePrice}"></div>
            <div class="field"><label>Máx. porções</label><input id="sz-max-${idx}" type="number" min="0" step="1" value="${sz.maxPortions}"></div>
            <div class="field"><label>Massa</label><input id="sz-dough-${idx}" type="number" min="0" step="0.5" value="${sz.doughQty}"></div>
          </div>
        </div>
      `).join('')}
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" onclick="cancelSizesForm()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveSizesForm()">Salvar tamanhos</button>
      </div>
    </div>
  `;
}

function startEditSizes(){
  closeStockForms();
  state.sizesDraft = state.customSizes.map(s => ({ ...s }));
  state.editingSizes = true;
  render();
}
function cancelSizesForm(){ closeStockForms(); render(); }

async function saveSizesForm(){
  const draft = state.sizesDraft || [];
  const sizes = [];
  for(let idx = 0; idx < draft.length; idx++){
    const name = document.getElementById('sz-name-' + idx).value.trim();
    const basePrice = parseFloat(String(document.getElementById('sz-price-' + idx).value).replace(',', '.'));
    const maxPortions = Math.max(0, Math.floor(parseFloat(String(document.getElementById('sz-max-' + idx).value).replace(',', '.')) || 0));
    const doughQty = parseFloat(String(document.getElementById('sz-dough-' + idx).value).replace(',', '.'));
    if(!name){ alert('Todo tamanho precisa de um nome.'); return; }
    if(!(basePrice >= 0) || !(doughQty >= 0)){
      alert('Confira os números de "' + name + '": preço e massa não podem ser negativos.');
      return;
    }
    sizes.push({ id: draft[idx].id, name, basePrice, factor: draft[idx].factor, doughQty, maxPortions, sort: idx + 1 });
  }
  const err = await saveCustomSizes(sizes);
  if(err){ alert('Não foi possível salvar os tamanhos agora.'); return; }
  closeStockForms();
  await loadCustomConfig();
  playSoundEffect('ding');
  render();
}

async function createDefaultSizes(){
  const sizes = [
    { id: 'P', name: 'Pequeno', basePrice: 5, factor: 1, doughQty: 0.5, maxPortions: 3, sort: 1 },
    { id: 'M', name: 'Médio', basePrice: 7, factor: 1, doughQty: 1, maxPortions: 5, sort: 2 },
    { id: 'G', name: 'Grande', basePrice: 10, factor: 1, doughQty: 1.5, maxPortions: 8, sort: 3 }
  ];
  const err = await saveCustomSizes(sizes);
  if(err){ alert('Não foi possível criar os tamanhos. Rode o migration-personalizado.sql no Supabase e tente de novo.'); return; }
  // se ainda não há massa escolhida, tenta achar pelo nome
  if(!state.customSettings.doughId){
    const dough = state.ingredients.find(i => /massa/i.test(i.name));
    if(dough) await saveCustomSettings({ active: true, doughId: dough.id });
  }
  await loadCustomConfig();
  playSoundEffect('ding');
  render();
}

// ---------- ingredientes do personalizado ----------
function customIngredientCard(ing){
  const lv = ingredientLevel(ing);
  return `
    <div class="s-card tone-${ing.customEnabled ? lv.tone : 'none'}" style="${ing.customEnabled ? '' : 'opacity:0.7;'}">
      <div class="s-icon">${ingredientEmoji(ing.name)}</div>
      <div class="s-main">
        <div class="s-title">
          ${escapeHtml(ing.name)}
          ${ing.customEnabled ? '<span class="s-tag ok">disponível</span>' : '<span class="s-tag">oculto</span>'}
        </div>
        <div class="s-qty">
          ${ing.customEnabled
            ? `<span class="s-sub">${escapeHtml(ing.customCategory)} · 1 ${escapeHtml(portionNoun(ing, 1))}${portionAmountText(ing, 1) ? ' = <b class="grams">' + portionAmountText(ing, 1) + '</b>' : ''} · <b>${money(ing.customPrice)}</b> cada · até ${ing.customMaxQty > 0 ? ing.customMaxQty : '∞'}</span>`
            : '<span class="s-sub">Não aparece para o cliente montar o pastel.</span>'}
        </div>
        <div class="s-qty"><span class="s-sub">Estoque: ${fmtQty(ing.stock)} ${ing.unit}</span></div>
        ${ing.customEnabled ? barHtml(lv) : ''}
        <div class="s-actions">
          <button class="btn btn-outline btn-sm" onclick="toggleIngredientCustom('${ing.id}')">${ing.customEnabled ? 'Ocultar' : 'Mostrar'}</button>
          <button class="btn btn-primary btn-sm" onclick="startEditCustomIng('${ing.id}')">Configurar</button>
        </div>
      </div>
    </div>
  `;
}

function customIngredientForm(ing){
  const cats = [...new Set([...CUSTOM_CATEGORY_ORDER, ...state.ingredients.map(i => i.customCategory)])];
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:10px;">${ingredientEmoji(ing.name)} ${escapeHtml(ing.name)} no personalizado</h4>
      <label class="check-row">
        <input type="checkbox" id="ci-enabled" ${ing.customEnabled ? 'checked' : ''}>
        <span>Disponível para o cliente escolher</span>
      </label>
      <div class="field">
        <label>Categoria (como aparece agrupado)</label>
        <input id="ci-cat" list="ci-cat-list" value="${escapeHtml(ing.customCategory)}" placeholder="Ex: Carnes, Queijos, Doces">
        <datalist id="ci-cat-list">${cats.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
      </div>
      <div class="field">
        <label>Nome da porção (como o cliente vê)</label>
        <input id="ci-label" list="ci-label-list" value="${escapeHtml(ing.customPortionLabel)}" placeholder="Ex: fatia, colher, pitada">
        <datalist id="ci-label-list">${['fatia', 'colher', 'porção', 'pitada', 'rodela', 'metade', 'punhado'].map(l => `<option value="${l}">`).join('')}</datalist>
      </div>
      <div class="field">
        <label>Quanto pesa 1 porção (${ing.unit})</label>
        <input id="ci-portion" type="number" min="0" step="any" value="${ing.customPortion}">
        <small class="muted" style="display:block; margin-top:4px;">Ex.: 1 fatia de queijo = 25 ${ing.unit}. É esse valor que aparece pro cliente e que baixa do estoque a cada porção. 0 = não mostra peso nem baixa estoque.</small>
      </div>
      <div class="field">
        <label>Preço de 1 porção (R$)</label>
        <input id="ci-price" type="number" min="0" step="0.05" value="${ing.customPrice}">
      </div>
      <div class="field">
        <label>Máximo de porções num pastel</label>
        <input id="ci-max" type="number" min="0" step="1" value="${ing.customMaxQty}">
        <small class="muted" style="display:block; margin-top:4px;">0 = sem limite (o tamanho do pastel também limita o total de porções).</small>
      </div>
      <div class="muted" style="margin-bottom:10px; background:#F9FAFB; border-radius:10px; padding:8px 10px;">
        O cliente verá: <b>1 ${escapeHtml(portionNoun(ing, 1))}${portionAmountText(ing, 1) ? ' = ' + portionAmountText(ing, 1) : ''}</b>,
        <b>2 ${escapeHtml(portionNoun(ing, 2))}${portionAmountText(ing, 2) ? ' = ' + portionAmountText(ing, 2) : ''}</b>...
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" onclick="cancelCustomIngForm()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveCustomIngForm('${ing.id}')">Salvar</button>
      </div>
    </div>
  `;
}

function startEditCustomIng(id){
  closeStockForms();
  state.editingCustomIngId = id;
  render();
}
function cancelCustomIngForm(){ closeStockForms(); render(); }

async function saveCustomIngForm(id){
  const f = {
    customEnabled: document.getElementById('ci-enabled').checked,
    customCategory: document.getElementById('ci-cat').value.trim() || 'Outros',
    customPortionLabel: document.getElementById('ci-label').value.trim() || 'porção',
    customPortion: Math.max(0, parseFloat(String(document.getElementById('ci-portion').value).replace(',', '.')) || 0),
    customPrice: Math.max(0, parseFloat(String(document.getElementById('ci-price').value).replace(',', '.')) || 0),
    customMaxQty: Math.max(0, Math.floor(parseFloat(String(document.getElementById('ci-max').value).replace(',', '.')) || 0))
  };
  const err = await saveIngredientCustom(id, f);
  if(err){ alert('Não foi possível salvar. Confira se rodou o migration-personalizado.sql no Supabase.'); return; }
  closeStockForms();
  await loadIngredientsAndRecipes();
  playSoundEffect('ding');
  render();
}

async function toggleIngredientCustom(id){
  const ing = ingredientById(id);
  if(!ing) return;
  const err = await saveIngredientCustom(id, {
    customEnabled: !ing.customEnabled, customCategory: ing.customCategory,
    customPortion: ing.customPortion, customPrice: ing.customPrice,
    customPortionLabel: ing.customPortionLabel, customMaxQty: ing.customMaxQty
  });
  if(err){ alert('Não foi possível salvar agora.'); return; }
  ing.customEnabled = !ing.customEnabled;
  playSoundEffect('pop');
  render();
}
