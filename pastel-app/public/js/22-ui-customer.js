// ============================================================
// FLUXO DO CLIENTE: CARDÁPIO -> SACOLA -> HORÁRIO -> CONFIRMAÇÃO
// ============================================================
function customerHeader(activeLabel){
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">🥟</div>
        <div><div class="brand-title">Pastel Sem Fila</div></div>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn" onclick="toggleSound()">${state.soundOn?'🔊':'🔇'}</button>
        <button class="badge-btn" onclick="goMyOrders()">Meus Pedidos</button>
        <button class="icon-btn" title="Sair da conta" onclick="handleLogoutCustomer()">🚪</button>
      </div>
    </header>
  `;
}

function viewCustomer(){
  const building = state.step === 1 && state.builderOpen;
  return `
    ${customerHeader()}
    <main>
      ${state.step < 4 && !building ? stepsNav() : ''}
      ${building ? viewBuilder() : ''}
      ${state.step === 1 && !building ? stepMenu() : ''}
      ${state.step === 2 ? stepCart() : ''}
      ${state.step === 3 ? stepSlots() : ''}
      ${state.step === 4 ? stepConfirm() : ''}
    </main>
    ${state.step === 1 && !building && cartCount() > 0 ? floatCartBar() : ''}
  `;
}

function stepsNav(){
  const steps = ['Cardápio', 'Sacola', 'Horário'];
  return `
    <div class="steps-nav">
      ${steps.map((s, idx) => {
        const num = idx + 1;
        const cls = num < state.step ? 'done' : (num === state.step ? 'active' : '');
        return `<div class="step-pill ${cls}">${num}. ${s}</div>`;
      }).join('')}
    </div>
  `;
}

function floatCartBar(){
  const t = calcTotals();
  return `
    <div class="cart-bar">
      <div>
        <div style="font-weight: 800; font-size: 15px;">${cartCount()} ${cartCount()===1?'item':'itens'} na sacola</div>
        <div style="font-size: 13px; opacity: 0.9;">Total: ${money(t.total)}</div>
      </div>
      <button class="btn btn-outline" style="padding: 8px 16px; font-size: 13px; color: var(--brand-red);" onclick="playSoundEffect('pop'); goStep(2)">Ver Sacola ➔</button>
    </div>
  `;
}

function stepMenu(){
  const activeItems = visibleMenuItems(); // já esconde o que está sem estoque
  const highlights = activeItems.filter(m => m.highlight);
  const categories = [...new Set(activeItems.map(m => m.cat))];

  return `
    <div class="promo-banner">
      <div class="promo-icon">🎁</div>
      <div class="promo-text">
        <h4>Promoções ativas</h4>
        <p>${promoBannerText()}</p>
      </div>
    </div>

    ${customEntryCardHtml()}

    ${activeItems.length === 0 && !customStockAvailable() ? `
      <div style="text-align:center; padding:30px 10px; color:var(--text-muted);">
        <div style="font-size:40px; margin-bottom:8px;">😅</div>
        <b>Estamos sem itens disponíveis no momento.</b><br>
        <span style="font-size:13px;">Volte daqui a pouco — assim que repormos o estoque, o cardápio volta!</span>
      </div>
    ` : ''}

    ${highlights.length > 0 ? `
      <div class="section-header">
        <h3>🔥 Destaques da Casa</h3>
        <span>Desperte a Fome</span>
      </div>
      <div class="carousel-wrap">
        ${highlights.map(item => `
          <div class="highlight-card">
            <div class="highlight-img-box">
              ${item.badge ? `<div class="highlight-badge">${item.badge}</div>` : ''}
              ${renderImageHtml(item.image, item.emoji)}
            </div>
            <div class="highlight-content">
              <div class="highlight-title">
                <span>${item.name}</span>
              </div>
              <div class="highlight-desc">${item.desc}</div>
              <div class="highlight-bottom">
                <span class="price-highlight">${money(item.price)}</span>
                <button class="btn btn-primary btn-sm" onclick="addToCart('${item.id}', event)">+ Adicionar</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${categories.map(cat => `
      <div class="section-header">
        <h3>${cat}</h3>
      </div>
      ${activeItems.filter(m => m.cat === cat).map(foodCardRow).join('')}
    `).join('')}
  `;
}

function promoBannerText(){
  const active = (state.promotions || []).filter(p => p.active !== false);
  if(active.length === 0) return 'Nenhuma promoção ativa no momento.';
  return active.map(p => {
    if(p.type === 'combo') return `<b>${escapeHtml(p.name)}</b>: leve ${p.qty_a} ${p.cat_a} + ${p.qty_b} ${p.cat_b} e ganhe ${money(p.value)} de desconto.`;
    if(p.type === 'percent') return `<b>${escapeHtml(p.name)}</b>: ${p.value}% off acima de ${money(p.min_subtotal||0)}.`;
    return `<b>${escapeHtml(p.name)}</b>: ${money(p.value)} off acima de ${money(p.min_subtotal||0)}.`;
  }).join(' ');
}

function foodCardRow(item){
  const qty = state.cart[item.id] || 0;
  return `
    <div class="food-card">
      ${renderImageHtml(item.image, item.emoji, 'food-thumb')}
      <div class="food-details">
        <div>
          <div class="food-name">${item.name}</div>
          <div class="food-desc">${item.desc}</div>
        </div>
        <div class="food-bottom">
          <span class="food-price">${money(item.price)}</span>
          <div class="qty-selector">
            ${qty > 0 ? `<button class="qty-btn-sm" onclick="changeQty('${item.id}', -1)">−</button>` : ''}
            ${qty > 0 ? `<span class="qty-num">${qty}</span>` : ''}
            <button class="qty-btn-sm" style="background: var(--brand-red); color: #FFF;" onclick="addToCart('${item.id}', event)">+</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function addToCart(id, evt){
  if(!canAddOne(id)){
    playSoundEffect('error');
    showToast('Não há mais estoque disponível deste item.');
    return;
  }
  playSoundEffect('pop');
  state.cart[id] = (state.cart[id] || 0) + 1;
  render();
}
function changeQty(id, delta){
  playSoundEffect('pop');
  const next = Math.max(0, (state.cart[id] || 0) + delta);
  if(next === 0) delete state.cart[id];
  else state.cart[id] = next;
  render();
}

function goStep(n){
  state.step = n;
  state.builderOpen = false;
  if(n === 3) prepSlotsStep();
  else {
    render();
    if(n === 1 || n === 2) refreshStockInBackground();
  }
}

function stepCart(){
  const items = cartItems();
  const t = calcTotals();
  if(items.length === 0 && state.customCart.length === 0){
    return `
      <div style="text-align: center; padding: 40px 10px;">
        <div style="font-size: 50px; margin-bottom: 10px;">🛒</div>
        <h3>Sua sacola está vazia</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin: 8px 0 20px;">Adicione pastéis crocantes e bebidas para continuar.</p>
        <button class="btn btn-primary" onclick="goStep(1)">Ver Cardápio</button>
      </div>
    `;
  }

  return `
    <h2 style="font-size: 20px; margin-bottom: 14px;">Resumo do Pedido</h2>
    <div class="ticket-card">
      ${items.map(i => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">${i.emoji} ${i.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${i.qty}x ${money(i.price)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800;">${money(i.price * i.qty)}</div>
            <button style="background: none; color: var(--brand-red); font-size: 11px; font-weight: 700;" onclick="changeQty('${i.id}', -${i.qty})">remover</button>
          </div>
        </div>
      `).join('')}

      ${state.customCart.map(l => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line); gap:10px;">
          <div style="min-width:0;">
            <div style="font-weight: 700; font-size: 14px;">🧑‍🍳 ${escapeHtml(customLineLabel(l))}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top:2px;">${customLineIngredientNames(l).map(escapeHtml).join(', ')}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${l.qty}x ${money(customUnitPrice(l.sizeId, l.ingredientIds))}</div>
          </div>
          <div style="text-align: right; flex:none;">
            <div style="font-weight: 800;">${money(customLineTotal(l))}</div>
            <button style="background: none; color: var(--brand-red); font-size: 11px; font-weight: 700;" onclick="removeCustomLine('${l.uid}')">remover</button>
          </div>
        </div>
      `).join('')}

      <div style="margin-top: 14px; padding-top: 10px; border-top: 2px solid var(--text-main);">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>Subtotal</span><span>${money(t.subtotal)}</span>
        </div>
        ${t.applied.map(a => `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--success); font-weight: 700; margin-bottom: 4px;">
            <span>🔥 ${escapeHtml(a.name)}</span><span>-${money(a.amount)}</span>
          </div>
        `).join('')}
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; margin-top: 6px;">
          <span>Total</span><span>${money(t.total)}</span>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button class="btn btn-outline" style="flex: 1;" onclick="goStep(1)">+ Adicionar Mais</button>
      <button class="btn btn-primary" style="flex: 1;" onclick="goStep(3)">Escolher Horário ➔</button>
    </div>
  `;
}

async function prepSlotsStep(){
  await loadOrders();
  await loadStock();
  const changed = clampCartToStock();
  if(cartCount() === 0) state.step = 2; // tudo esgotou: volta pra sacola vazia
  if(!state.selectedDate) state.selectedDate = startOfDay(new Date());
  state.slotsCache = generateSlots(state.selectedDate);
  render();
  if(changed) showToast('Alguns itens esgotaram e foram ajustados na sua sacola.');
}

function stepSlots(){
  const t = calcTotals();
  return `
    <h2 style="font-size: 20px; margin-bottom: 4px;">Agendamento de Retirada</h2>
    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Vagas limitadas por horário para garantir pastéis quentinhos sem fila!</p>

    <div class="field">
      <label>Seu Nome</label>
      <input type="text" value="${state.customer.name}" oninput="state.customer.name=this.value" placeholder="Como podemos te chamar?">
    </div>

    <div class="field">
      <label>WhatsApp / Telefone</label>
      <input type="tel" value="${state.customer.phone}" oninput="state.customer.phone=this.value" placeholder="(11) 99999-9999">
    </div>

    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Dia da Retirada</label>
    ${renderDaySelector()}

    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Horários Disponíveis</label>
    ${renderSlotGrid()}

    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <button class="btn btn-outline" onclick="goStep(2)">Voltar</button>
      <button class="btn btn-primary btn-block" id="confirmBtn" ${state.selectedSlotKey ? '' : 'disabled'} onclick="submitOrder()">
        Confirmar Pedido • ${money(t.total)}
      </button>
    </div>
  `;
}

function renderDaySelector(){
  const days = [];
  const base = startOfDay(new Date());
  for(let i = 0; i <= state.config.maxDaysAhead; i++){
    days.push({ date: new Date(base.getTime() + i*86400000), offset: i });
  }
  return `
    <div class="day-row">
      ${days.map(d => {
        const sel = sameDay(d.date, state.selectedDate);
        return `<button class="day-pill ${sel ? 'selected' : ''}" onclick="selectDate(${d.offset})">${dayLabel(d.date, d.offset)}</button>`;
      }).join('')}
    </div>
  `;
}

async function selectDate(offset){
  playSoundEffect('pop');
  const base = startOfDay(new Date());
  state.selectedDate = new Date(base.getTime() + offset*86400000);
  state.selectedSlotKey = null;
  await loadOrders();
  state.slotsCache = generateSlots(state.selectedDate);
  render();
}

function renderSlotGrid(){
  if(state.slotsCache.length === 0){
    return `<div style="text-align: center; padding: 20px; background: #FFF; border-radius: 12px; color: var(--text-muted); font-size: 13px;">Não há mais horários disponíveis neste dia. Escolha outra data acima.</div>`;
  }
  return `
    <div class="slot-grid">
      ${state.slotsCache.map(d => {
        const key = slotKeyFor(d);
        const used = countForSlot(key);
        const rem = state.config.maxPerSlot - used;
        const full = rem <= 0;
        const sel = state.selectedSlotKey === key;
        return `
          <button class="slot-btn ${full ? 'full' : ''} ${sel ? 'selected' : ''}" ${full ? 'disabled' : ''} onclick="selectSlot('${key}')">
            ${timeLabel(d)}
            <span class="rem">${full ? '' : rem + ' vaga' + (rem > 1 ? 's' : '')}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function selectSlot(key){ playSoundEffect('pop'); state.selectedSlotKey = key; render(); }

async function submitOrder(){
  if(!state.customer.name.trim() || !state.customer.phone.trim()){
    alert('Por favor, informe seu nome e telefone.'); return;
  }
  if(!state.selectedSlotKey){ alert('Escolha um horário de retirada.'); return; }

  const btn = document.getElementById('confirmBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Processando...'; }

  await loadOrders();
  const used = countForSlot(state.selectedSlotKey);
  if(used >= state.config.maxPerSlot){
    alert('Ops! Esse horário acabou de lotar. Escolha outro horário.');
    state.selectedSlotKey = null;
    state.slotsCache = generateSlots(state.selectedDate);
    render();
    return;
  }

  const items = cartItems();
  const customLines = state.customCart.map(l => ({ ...l, ingredientIds: [...l.ingredientIds] }));
  const t = calcTotals();

  // Dá baixa no estoque ANTES de gravar o pedido. A conta é feita dentro do
  // banco, numa transação só: se faltar qualquer coisa, nada é baixado.
  const stockErr = await consumeStock(items, customLines);
  if(stockErr){
    if(isStockShortage(stockErr)){
      alert('Ops! Algum item do seu pedido acabou de esgotar. Já ajustamos a sua sacola.');
      await loadStock();
      clampCartToStock();
      state.step = cartCount() > 0 ? 2 : 1;
      render();
    } else {
      alert('Não foi possível reservar os itens agora. Tente novamente.');
      if(btn){ btn.disabled = false; btn.textContent = `Confirmar Pedido • ${money(t.total)}`; }
    }
    return;
  }

  const parts = state.selectedSlotKey.split('-');
  const pickupDateKey = parts.slice(0,3).join('-');
  const pickupDate = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
  const offset = Math.round((startOfDay(pickupDate) - startOfDay(new Date())) / 86400000);
  const pickupDayLabel = dayLabel(startOfDay(pickupDate), offset);

  const sameDayOrders = state.orders.filter(o => o.slotKey.startsWith(pickupDateKey+'-') && o.status !== 'cancelado').length;
  const code = '#' + pad(sameDayOrders + 1);

  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    code,
    customerName: state.customer.name.trim(),
    phone: state.customer.phone.trim(),
    items: [
      ...items.map(i=>({name:i.name, qty:i.qty, price:i.price})),
      ...customLines.map(customOrderItem)
    ],
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    slotKey: state.selectedSlotKey,
    pickupLabel: timeLabel(pickupDate),
    pickupDayLabel,
    status: 'pendente',
    paymentStatus: 'pendente',
    userId: state.customerUser ? state.customerUser.id : null,
    createdAt: new Date().toISOString()
  };

  const err = await insertOrder(order);
  if(err){
    await restoreStock(items, customLines); // devolve o que foi baixado
    alert('Não foi possível registrar o pedido. Tente novamente.');
    if(btn){ btn.disabled = false; btn.textContent = `Confirmar Pedido • ${money(t.total)}`; }
    return;
  }
  state.orders.push(order);

  state.lastOrder = order;
  state.step = 4;
  state.cart = {};
  state.customCart = [];
  playSoundEffect('chime');
  render();
}

function stepConfirm(){
  const o = state.lastOrder;
  if(!o) return `<div style="text-align:center; padding: 30px;">Nenhum pedido recente.</div>`;

  return `
    <div style="text-align: center;">
      <h2 style="font-size: 22px; color: var(--success);">Pedido Confirmado! 🎉</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Já enviamos pra cozinha!</p>

      <div class="stamp-box">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase;">Senha de Retirada</div>
        <div class="stamp-code">${o.code}</div>
      </div>

      <p style="font-size: 14px; margin-bottom: 16px;">
        Retirada em <b>${o.pickupDayLabel} às ${o.pickupLabel}</b><br>
        <span style="font-size: 12px; color: var(--text-muted);">Chegue e informe sua senha no balcão.</span>
      </p>
    </div>

    ${pixBoxHtml(o)}

    <div class="ticket-card">
      <h4 style="margin-bottom: 8px;">Detalhes do Pedido</h4>
      ${o.items.map(i=>`
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;">
          <span>${escapeHtml(orderItemText(i))}</span><span>${money(i.price*i.qty)}</span>
        </div>
      `).join('')}
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); font-weight: 800; display: flex; justify-content: space-between;">
        <span>Total a Pagar</span><span>${money(o.total)}</span>
      </div>
    </div>

    <button class="btn btn-primary btn-block" onclick="goStep(1)">Fazer Outro Pedido</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="goMyOrders()">Ver meus pedidos</button>
  `;
}

// Caixa de pagamento Pix — some sozinha se a loja não tiver chave Pix
// cadastrada em Configurações (o pedido continua funcionando normal,
// só sem a cobrança automática de QR code).
function pixBoxHtml(order){
  const cfg = state.config;
  if(!cfg.pixKey) return '';
  const payload = generatePixPayload({
    pixKey: normalizePixKey(cfg.pixKey, cfg.pixKeyType), merchantName: cfg.merchantName, merchantCity: cfg.merchantCity,
    amount: order.total, txid: order.code.replace('#','PED')
  });
  if(!payload) return '';
  return `
    <div class="ticket-card" style="text-align:center;">
      <h4 style="margin-bottom:10px;">Pagar com Pix</h4>
      <img src="${pixQrImageUrl(payload)}" alt="QR code Pix" width="220" height="220"
           style="margin:0 auto; display:block; border-radius:8px;"
           onerror="this.style.display='none';">
      <p style="font-size:12px; color:var(--text-muted); margin:10px 0;">Escaneie com o app do seu banco, ou copie o código abaixo:</p>
      <textarea readonly style="width:100%; font-size:11px; padding:8px; border-radius:8px; border:1.5px solid var(--line); resize:none;" rows="3">${payload}</textarea>
      <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="copyPixCode('${payload}', this)">Copiar código Pix</button>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:10px;">
        Assim que o pagamento cair, a equipe confirma no balcão ou aqui mesmo em "Meus Pedidos".
      </p>
    </div>
  `;
}
