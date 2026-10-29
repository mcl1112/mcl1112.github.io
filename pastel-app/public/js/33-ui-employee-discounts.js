// ============================================================
// EQUIPE: ABA DESCONTOS (promoções e combos editáveis)
// ============================================================
const PROMO_TYPE_LABEL = { combo: 'Combo (categoria + categoria)', percent: 'Desconto em %', fixed: 'Desconto em R$ fixo' };

function empDiscountsTab(){
  const cats = [...new Set(state.menu.map(m => m.cat))];
  if(state.customSizes.length > 0 && !cats.includes(CUSTOM_CAT)) cats.push(CUSTOM_CAT);
  return `
    <button class="btn btn-primary btn-block" style="margin-bottom: 14px;" onclick="startAddPromo()">+ Nova Promoção</button>

    ${state.addingPromo ? promoFormHtml(null, cats) : ''}

    ${state.promotions.length === 0 && !state.addingPromo ? `<div style="text-align:center; padding:30px 10px; color:var(--text-muted);">Nenhuma promoção cadastrada.</div>` : ''}

    ${state.promotions.map(p => state.editingPromoId === p.id ? promoFormHtml(p, cats) : promoCardHtml(p)).join('')}
  `;
}

function promoCardHtml(p){
  let desc = '';
  if(p.type === 'combo') desc = `Leve ${p.qty_a}x ${p.cat_a} + ${p.qty_b}x ${p.cat_b} → ${money(p.value)} de desconto`;
  else if(p.type === 'percent') desc = `${p.value}% de desconto acima de ${money(p.min_subtotal||0)}`;
  else desc = `${money(p.value)} de desconto acima de ${money(p.min_subtotal||0)}`;

  return `
    <div class="order-card-emp" style="${p.active===false?'opacity:0.5;':''}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:700;">${escapeHtml(p.name)}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${PROMO_TYPE_LABEL[p.type] || p.type}</div>
        </div>
        <span class="status-badge" style="background:${p.active!==false?'#DCFCE7':'#F3F4F6'}; color:${p.active!==false?'#16A34A':'#6B7280'};">${p.active!==false?'Ativa':'Pausada'}</span>
      </div>
      <div style="font-size:13px; margin:8px 0;">${desc}</div>
      <div style="display:flex; justify-content:flex-end; gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="togglePromoActive('${p.id}')">${p.active!==false?'Pausar':'Ativar'}</button>
        <button class="btn btn-outline btn-sm" onclick="state.editingPromoId='${p.id}'; state.addingPromo=false; render();">Editar</button>
        <button class="btn btn-sm" style="background:var(--brand-red); color:#FFF;" onclick="deletePromo('${p.id}')">Excluir</button>
      </div>
    </div>
  `;
}

function promoFormHtml(promo, cats){
  const f = promo || { type:'combo', name:'', active:true, cat_a:cats[0]||'', qty_a:2, cat_b:cats[1]||cats[0]||'', qty_b:1, min_subtotal:0, value:0 };
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom:10px;">${promo ? 'Editar Promoção' : 'Nova Promoção'}</h4>
      <div class="field"><label>Nome da promoção</label><input id="pf-name" value="${escapeHtml(f.name)}" placeholder="Ex: Combo Sexta Feliz"></div>
      <div class="field">
        <label>Tipo</label>
        <select id="pf-type" onchange="switchPromoFormType(this.value)">
          <option value="combo" ${f.type==='combo'?'selected':''}>Combo (categoria + categoria)</option>
          <option value="percent" ${f.type==='percent'?'selected':''}>Desconto em % sobre o pedido</option>
          <option value="fixed" ${f.type==='fixed'?'selected':''}>Desconto em R$ fixo</option>
        </select>
      </div>

      <div id="pf-combo-fields" style="${f.type!=='combo'?'display:none;':''}">
        <div class="field"><label>Categoria A</label>
          <select id="pf-cat-a">${cats.map(c=>`<option value="${c}" ${c===f.cat_a?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Quantidade de A</label><input id="pf-qty-a" type="number" min="1" value="${f.qty_a||2}"></div>
        <div class="field"><label>Categoria B</label>
          <select id="pf-cat-b">${cats.map(c=>`<option value="${c}" ${c===f.cat_b?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Quantidade de B</label><input id="pf-qty-b" type="number" min="1" value="${f.qty_b||1}"></div>
        <div class="field"><label>Desconto (R$) por combo formado</label><input id="pf-value-combo" type="number" step="0.10" min="0" value="${f.value||0}"></div>
      </div>

      <div id="pf-money-fields" style="${f.type==='combo'?'display:none;':''}">
        <div class="field"><label>Pedido mínimo (R$) para valer a promoção</label><input id="pf-min" type="number" step="0.50" min="0" value="${f.min_subtotal||0}"></div>
        <div class="field"><label id="pf-value-label">${f.type==='percent' ? 'Percentual de desconto (%)' : 'Desconto (R$)'}</label><input id="pf-value-money" type="number" step="${f.type==='percent'?'1':'0.10'}" min="0" value="${f.type==='combo'?0:(f.value||0)}"></div>
      </div>

      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn btn-outline" onclick="cancelPromoForm()">Cancelar</button>
        <button class="btn btn-primary" onclick="savePromoForm('${promo?promo.id:''}')">Salvar</button>
      </div>
    </div>
  `;
}

function switchPromoFormType(type){
  const comboBox = document.getElementById('pf-combo-fields');
  const moneyBox = document.getElementById('pf-money-fields');
  const label = document.getElementById('pf-value-label');
  if(type === 'combo'){
    comboBox.style.display = '';
    moneyBox.style.display = 'none';
  } else {
    comboBox.style.display = 'none';
    moneyBox.style.display = '';
    label.textContent = type === 'percent' ? 'Percentual de desconto (%)' : 'Desconto (R$)';
  }
}

function startAddPromo(){ state.addingPromo = true; state.editingPromoId = null; render(); }
function cancelPromoForm(){ state.addingPromo = false; state.editingPromoId = null; render(); }

async function savePromoForm(id){
  const name = document.getElementById('pf-name').value.trim();
  const type = document.getElementById('pf-type').value;
  if(!name){ alert('Dê um nome à promoção.'); return; }

  let promo;
  if(type === 'combo'){
    promo = {
      id: id || 'p' + Date.now().toString(36), type, name, active: true,
      cat_a: document.getElementById('pf-cat-a').value,
      qty_a: parseInt(document.getElementById('pf-qty-a').value) || 1,
      cat_b: document.getElementById('pf-cat-b').value,
      qty_b: parseInt(document.getElementById('pf-qty-b').value) || 1,
      min_subtotal: null,
      value: parseFloat(document.getElementById('pf-value-combo').value) || 0
    };
  } else {
    promo = {
      id: id || 'p' + Date.now().toString(36), type, name, active: true,
      cat_a: null, qty_a: null, cat_b: null, qty_b: null,
      min_subtotal: parseFloat(document.getElementById('pf-min').value) || 0,
      value: parseFloat(document.getElementById('pf-value-money').value) || 0
    };
  }
  if(id){
    const existing = state.promotions.find(p => p.id === id);
    promo.active = existing ? existing.active : true;
  }

  const idx = state.promotions.findIndex(p => p.id === promo.id);
  if(idx >= 0) state.promotions[idx] = promo; else state.promotions.push(promo);

  await savePromotion(promo);
  state.addingPromo = false;
  state.editingPromoId = null;
  playSoundEffect('ding');
  render();
}

async function togglePromoActive(id){
  const promo = state.promotions.find(p => p.id === id);
  if(promo){
    promo.active = promo.active === false ? true : false;
    await savePromotion(promo);
    render();
  }
}

async function deletePromo(id){
  if(!confirm('Excluir esta promoção?')) return;
  state.promotions = state.promotions.filter(p => p.id !== id);
  await deletePromotionRemote(id);
  render();
}
