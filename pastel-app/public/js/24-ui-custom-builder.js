// ============================================================
// CLIENTE: MONTE O SEU PASTEL
// O cliente escolhe o tamanho e, para cada ingrediente, QUANTAS PORÇÕES quer
// (ex.: 1 fatia de queijo = 25 g, 2 fatias = 50 g). A gramatura de cada porção
// aparece sempre, e o total escolhido também.
// ============================================================
const CUSTOM_CATEGORY_ORDER = ['Carnes', 'Frutos do mar', 'Queijos', 'Vegetais', 'Temperos', 'Doces'];

// Cartão que aparece no topo do cardápio
function customEntryCardHtml(){
  if(!customStockAvailable()) return '';
  return `
    <button class="custom-entry" onclick="openBuilder()">
      <div class="custom-entry-emoji">🧑‍🍳</div>
      <div class="custom-entry-text">
        <h3>Monte o seu pastel</h3>
        <p>Escolha o tamanho e quanto quer de cada recheio — feito na hora, do seu jeito.</p>
        <span class="custom-entry-price">a partir de ${money(customMinPrice())}</span>
      </div>
      <div class="custom-entry-go">➔</div>
    </button>
  `;
}

// ---------- ações ----------
function openBuilder(){
  playSoundEffect('pop');
  const first = state.customSizes.find(s => builderSizeAvailable(s.id)) || state.customSizes[0];
  state.builder = { sizeId: first ? first.id : null, picks: {}, qty: 1 };
  state.builderOpen = true;
  render();
  if(window.scrollTo) window.scrollTo(0, 0);
}
function closeBuilder(){
  state.builderOpen = false;
  render();
}

function fixBuilderQty(){
  const max = builderMaxQty();
  if(max >= 1 && state.builder.qty > max) state.builder.qty = max;
  if(state.builder.qty < 1) state.builder.qty = 1;
}

function builderSetSize(id){
  if(!builderSizeAvailable(id)){
    playSoundEffect('error');
    showToast('Esse tamanho está sem massa no momento.');
    return;
  }
  const d = state.builder;
  d.sizeId = id;
  const changed = fitPicksToSize(id, d.picks, d.qty);   // tamanho menor = menos porções
  fixBuilderQty();
  playSoundEffect('pop');
  render();
  if(changed) showToast('Ajustamos as porções para caber nesse tamanho.');
}

// +1 / -1 porção de um ingrediente
function builderStep(ingId, delta){
  const d = state.builder;
  const cur = d.picks[ingId] || 0;
  if(delta < 0){
    if(cur <= 0) return;
    d.picks[ingId] = cur - 1;
    if(d.picks[ingId] <= 0) delete d.picks[ingId];
  } else {
    const reason = builderPlusBlockReason(ingId);
    if(reason){
      playSoundEffect('error');
      showToast(reason === 'size' ? 'Esse tamanho já está cheio de recheio — escolha um tamanho maior.'
        : reason === 'max' ? 'Máximo de porções desse recheio atingido.'
        : 'Não há estoque suficiente desse recheio.');
      return;
    }
    d.picks[ingId] = cur + 1;
  }
  playSoundEffect('pop');
  render();
}

function builderChangeQty(delta){
  const d = state.builder;
  const next = d.qty + delta;
  if(next < 1) return;
  if(delta > 0 && next > builderMaxQty()){
    playSoundEffect('error');
    showToast('Não há estoque para mais unidades desse pastel.');
    return;
  }
  d.qty = next;
  playSoundEffect('pop');
  render();
}

function addCustomToCart(){
  const d = state.builder;
  if(!d.sizeId || totalPortions(d.picks) === 0){
    playSoundEffect('error');
    showToast('Escolha o tamanho e pelo menos 1 porção de recheio.');
    return;
  }
  if(builderDraftExceeds()){
    playSoundEffect('error');
    showToast('Estoque insuficiente para essa combinação.');
    return;
  }
  const picks = {};
  pickEntries(d.picks).forEach(([id, n]) => { picks[id] = n; });
  // mesmo tamanho + mesmas porções: soma na linha que já existe
  const same = state.customCart.find(l => l.sizeId === d.sizeId && picksKey(l.picks) === picksKey(picks));
  if(same) same.qty += d.qty;
  else state.customCart.push({
    uid: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    sizeId: d.sizeId, picks, qty: d.qty
  });
  state.builderOpen = false;
  playSoundEffect('pop');
  render();
  showToast('Pastel adicionado à sacola! 🥟');
}

function removeCustomLine(uid){
  state.customCart = state.customCart.filter(l => l.uid !== uid);
  playSoundEffect('pop');
  render();
}

// ---------- tela ----------
// Recheios agrupados por categoria. Quem está totalmente sem estoque nem aparece
// (como no cardápio).
function groupedCustomIngredients(){
  const d = state.builder;
  const list = enabledCustomIngredients().filter(ing =>
    !cartExceedsStock({}, [{ sizeId: d.sizeId, picks: { [ing.id]: 1 }, qty: 1 }]));
  const groups = {};
  list.forEach(ing => {
    const cat = ing.customCategory || 'Outros';
    (groups[cat] = groups[cat] || []).push(ing);
  });
  const rank = cat => { const i = CUSTOM_CATEGORY_ORDER.indexOf(cat); return i < 0 ? 99 : i; };
  return Object.keys(groups)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'pt-BR'))
    .map(cat => ({ cat, items: groups[cat].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }));
}

function sizeCardHtml(s){
  const sel = s.id === state.builder.sizeId;
  const ok = builderSizeAvailable(s.id);
  const px = Math.round(24 + (s.maxPortions || 4) * 3);
  return `
    <button class="size-card ${sel ? 'selected' : ''} ${ok ? '' : 'disabled'}" onclick="builderSetSize('${s.id}')">
      <div class="size-emoji" style="font-size:${Math.min(px, 50)}px;">🥟</div>
      <div class="size-name">${escapeHtml(s.name)}</div>
      <div class="size-price">${ok ? 'base ' + money(s.basePrice) : 'Sem estoque'}</div>
      ${ok && s.maxPortions > 0 ? `<div class="size-cap">até ${s.maxPortions} porções</div>` : ''}
    </button>
  `;
}

// Uma linha de ingrediente: nome, "1 fatia = 25 g", e o seletor de porções
function ingredientRowHtml(ing){
  const n = state.builder.picks[ing.id] || 0;
  const plusBlocked = builderPlusBlockReason(ing.id) !== null;
  const amount1 = portionAmountText(ing, 1);
  const priceTxt = ing.customPrice > 0 ? ` · +${money(ing.customPrice)} cada` : '';
  return `
    <div class="ing-row ${n > 0 ? 'active' : ''}">
      <div class="ing-emoji">${ingredientEmoji(ing.name)}</div>
      <div class="ing-info">
        <div class="ing-name">${escapeHtml(ing.name)}</div>
        <div class="ing-portion">1 ${escapeHtml(portionNoun(ing, 1))}${amount1 ? ` = <b class="grams">${amount1}</b>` : ''}${priceTxt}</div>
        ${n > 0 ? `<div class="ing-total">${n} ${escapeHtml(portionNoun(ing, n))}${portionAmountText(ing, n) ? ` = <b class="grams">${portionAmountText(ing, n)}</b>` : ''}${ing.customPrice > 0 ? ` · +${money(round2(ing.customPrice * n))}` : ''}</div>` : ''}
      </div>
      <div class="ing-stepper">
        <button class="step-btn" ${n === 0 ? 'disabled' : ''} onclick="builderStep('${ing.id}', -1)">−</button>
        <span class="step-num">${n}</span>
        <button class="step-btn plus" ${plusBlocked ? 'disabled' : ''} onclick="builderStep('${ing.id}', 1)">+</button>
      </div>
    </div>
  `;
}

function viewBuilder(){
  const d = state.builder;
  const size = customSizeById(d.sizeId);
  const unit = customUnitPrice(d.sizeId, d.picks);
  const total = round2(unit * d.qty);
  const used = totalPortions(d.picks);
  const exceeds = used > 0 && builderDraftExceeds();
  const canAdd = !!size && used > 0 && !exceeds;
  const groups = groupedCustomIngredients();
  const cap = size ? size.maxPortions : 0;
  const grams = fillingGrams(d.picks);
  const chosen = pickEntries(d.picks).map(([id, n]) => ({ ing: ingredientById(id), n })).filter(x => x.ing);

  return `
    <div class="builder">
      <button class="btn-ghost builder-back" onclick="closeBuilder()">← Voltar ao cardápio</button>

      <div class="builder-hero">
        <div class="builder-hero-emoji">🧑‍🍳</div>
        <div>
          <h2>Monte o seu pastel</h2>
          <p>Escolha quanto quer de cada recheio. Feito na hora, do seu jeito.</p>
        </div>
      </div>

      <div class="b-step"><span class="b-num">1</span><h3>Escolha o tamanho</h3></div>
      <div class="size-grid">${state.customSizes.map(sizeCardHtml).join('')}</div>

      <div class="b-step"><span class="b-num">2</span><h3>Escolha os recheios</h3></div>
      ${cap > 0 ? `
        <div class="cap-box ${used >= cap ? 'full' : ''}">
          <div class="cap-text"><b>${used}</b> de <b>${cap}</b> porções no pastel ${escapeHtml(size.name)}${used >= cap ? ' — cheio!' : ''}</div>
          <div class="bar"><i class="bar-fill ${used >= cap ? 'low' : 'ok'}" style="width:${Math.min(100, (used / cap) * 100)}%"></i></div>
        </div>` : ''}
      ${groups.length === 0 ? `<div class="muted" style="padding:14px 0;">Nenhum recheio disponível agora.</div>` : ''}
      ${groups.map(g => `
        <div class="chip-group">
          <div class="chip-group-title">${escapeHtml(g.cat)}</div>
          ${g.items.map(ingredientRowHtml).join('')}
        </div>
      `).join('')}

      <div class="builder-summary">
        <div class="builder-summary-title">Seu pastel${size ? ' · ' + escapeHtml(size.name) : ''}</div>
        ${chosen.length === 0
          ? `<div class="muted">Use o + nos recheios acima para montar.</div>`
          : `<div class="builder-summary-list">
               ${chosen.map(c => `<div>${ingredientEmoji(c.ing.name)} ${escapeHtml(pickText(c.ing, c.n))}</div>`).join('')}
               ${grams > 0 ? `<div class="builder-grams">Recheio total: <b class="grams">≈ ${fmtQty(grams)} g</b></div>` : ''}
             </div>`}
        ${exceeds ? `<div class="stock-warn" style="margin-top:8px;">Estoque insuficiente para essa combinação.</div>` : ''}
      </div>
    </div>

    <div class="builder-bar">
      <div class="builder-bar-price">
        <small>${d.qty > 1 ? d.qty + ' pastéis' : '1 pastel'}</small>
        <b>${money(total)}</b>
      </div>
      <div class="qty-selector">
        <button class="qty-btn-sm" onclick="builderChangeQty(-1)">−</button>
        <span class="qty-num">${d.qty}</span>
        <button class="qty-btn-sm" style="background: var(--brand-red); color:#FFF;" onclick="builderChangeQty(1)">+</button>
      </div>
      <button class="btn btn-primary" ${canAdd ? '' : 'disabled'} onclick="addCustomToCart()">Adicionar</button>
    </div>
  `;
}
