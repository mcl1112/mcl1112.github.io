// ============================================================
// CLIENTE: MONTE O SEU PASTEL
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
        <p>Escolha o tamanho e os recheios — feito na hora, do seu jeito.</p>
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
  state.builder = { sizeId: first ? first.id : null, ingredientIds: [], qty: 1 };
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
  // o tamanho novo pode pedir mais de algum recheio: tira o que não cabe no estoque
  const keep = [];
  for(const ingId of d.ingredientIds){
    const test = { sizeId: id, ingredientIds: [...keep, ingId], qty: d.qty };
    if(!cartExceedsStock(state.cart, [...state.customCart, test])) keep.push(ingId);
  }
  const removed = d.ingredientIds.length - keep.length;
  d.ingredientIds = keep;
  fixBuilderQty();
  playSoundEffect('pop');
  render();
  if(removed > 0) showToast('Tiramos recheios que não têm estoque nesse tamanho.');
}

function builderToggleIngredient(id){
  const d = state.builder;
  const idx = d.ingredientIds.indexOf(id);
  if(idx >= 0){
    d.ingredientIds.splice(idx, 1);
  } else {
    if(builderIngredientBlocked(id)){
      playSoundEffect('error');
      showToast('Não há estoque suficiente desse recheio.');
      return;
    }
    d.ingredientIds.push(id);
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
  if(!d.sizeId || d.ingredientIds.length === 0){
    playSoundEffect('error');
    showToast('Escolha o tamanho e pelo menos 1 recheio.');
    return;
  }
  if(builderDraftExceeds()){
    playSoundEffect('error');
    showToast('Estoque insuficiente para essa combinação.');
    return;
  }
  const ids = [...d.ingredientIds].sort();
  // mesmo tamanho + mesmos recheios: soma na linha que já existe
  const same = state.customCart.find(l =>
    l.sizeId === d.sizeId && l.ingredientIds.length === ids.length &&
    [...l.ingredientIds].sort().every((x, k) => x === ids[k]));
  if(same) same.qty += d.qty;
  else state.customCart.push({
    uid: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    sizeId: d.sizeId, ingredientIds: ids, qty: d.qty
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
// Recheios que o cliente pode escolher agrupados por categoria.
// Quem está totalmente sem estoque nesse tamanho nem aparece (como no cardápio).
function groupedCustomIngredients(){
  const d = state.builder;
  const list = enabledCustomIngredients().filter(ing =>
    !cartExceedsStock({}, [{ sizeId: d.sizeId, ingredientIds: [ing.id], qty: 1 }]));
  const groups = {};
  list.forEach(ing => { (groups[ing.customCategory || 'Outros'] = groups[ing.customCategory || 'Outros'] || []).push(ing); });
  const rank = cat => { const i = CUSTOM_CATEGORY_ORDER.indexOf(cat); return i < 0 ? 99 : i; };
  return Object.keys(groups)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'pt-BR'))
    .map(cat => ({ cat, items: groups[cat].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }));
}

function sizeCardHtml(s){
  const sel = s.id === state.builder.sizeId;
  const ok = builderSizeAvailable(s.id);
  const px = Math.round(20 + s.factor * 14);
  return `
    <button class="size-card ${sel ? 'selected' : ''} ${ok ? '' : 'disabled'}" onclick="builderSetSize('${s.id}')">
      <div class="size-emoji" style="font-size:${px}px;">🥟</div>
      <div class="size-name">${escapeHtml(s.name)}</div>
      <div class="size-price">${ok ? 'base ' + money(s.basePrice) : 'Sem estoque'}</div>
    </button>
  `;
}

function chipHtml(ing){
  const d = state.builder;
  const size = customSizeById(d.sizeId);
  const selected = d.ingredientIds.includes(ing.id);
  const blocked = !selected && builderIngredientBlocked(ing.id);
  const extra = size ? customIngredientExtra(ing, size) : 0;
  return `
    <button class="chip ${selected ? 'selected' : ''} ${blocked ? 'disabled' : ''}" ${blocked ? 'disabled' : ''}
            onclick="builderToggleIngredient('${ing.id}')">
      <span class="chip-emoji">${ingredientEmoji(ing.name)}</span>
      <span class="chip-name">${escapeHtml(ing.name)}</span>
      ${blocked ? '<small>Sem estoque</small>' : (extra > 0 ? `<small>+${money(extra)}</small>` : '')}
    </button>
  `;
}

function viewBuilder(){
  const d = state.builder;
  const size = customSizeById(d.sizeId);
  const unit = customUnitPrice(d.sizeId, d.ingredientIds);
  const total = round2(unit * d.qty);
  const exceeds = d.ingredientIds.length > 0 && builderDraftExceeds();
  const canAdd = !!size && d.ingredientIds.length > 0 && !exceeds;
  const groups = groupedCustomIngredients();
  const chosen = d.ingredientIds.map(id => ingredientById(id)).filter(Boolean);

  return `
    <div class="builder">
      <button class="btn-ghost builder-back" onclick="closeBuilder()">← Voltar ao cardápio</button>

      <div class="builder-hero">
        <div class="builder-hero-emoji">🧑‍🍳</div>
        <div>
          <h2>Monte o seu pastel</h2>
          <p>Feito na hora, do jeitinho que você quer.</p>
        </div>
      </div>

      <div class="b-step"><span class="b-num">1</span><h3>Escolha o tamanho</h3></div>
      <div class="size-grid">${state.customSizes.map(sizeCardHtml).join('')}</div>

      <div class="b-step"><span class="b-num">2</span><h3>Escolha os recheios</h3></div>
      ${groups.length === 0 ? `<div class="muted" style="padding:14px 0;">Nenhum recheio disponível agora.</div>` : ''}
      ${groups.map(g => `
        <div class="chip-group">
          <div class="chip-group-title">${escapeHtml(g.cat)}</div>
          <div class="chip-row">${g.items.map(chipHtml).join('')}</div>
        </div>
      `).join('')}

      <div class="builder-summary">
        <div class="builder-summary-title">Seu pastel</div>
        ${chosen.length === 0
          ? `<div class="muted">Toque nos recheios acima para montar.</div>`
          : `<div class="builder-summary-list">${size ? `<b>${escapeHtml(size.name)}</b> com ` : ''}${chosen.map(i => `${ingredientEmoji(i.name)} ${escapeHtml(i.name)}`).join(' · ')}</div>`}
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
