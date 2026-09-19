// ============================================================
// EQUIPE: ABA PEDIDOS
// ============================================================
function empOrdersTab(){
  if(!state.empSelectedDateStr) state.empSelectedDateStr = dateKeyFor(new Date());
  const dateStr = state.empSelectedDateStr;
  const dayOrders = state.orders.filter(o => o.slotKey.startsWith(dateStr+'-'));

  return `
    <div style="display: flex; gap: 8px; margin-bottom: 14px;">
      <input type="date" value="${dateStr}" onchange="state.empSelectedDateStr=this.value; render();" style="padding: 8px; border-radius: 8px; border: 1px solid var(--line); flex: 1;">
      <button class="btn btn-outline btn-sm" onclick="state.empSelectedDateStr='${dateKeyFor(new Date())}'; render();">Hoje</button>
    </div>

    ${dayOrders.length === 0 ? `<div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">Nenhum pedido para esta data.</div>` : ''}

    ${dayOrders.map(o => `
      <div class="order-card-emp">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <span style="font-weight: 800; font-size: 16px;">${o.code}</span>
            <span style="font-size: 13px; color: var(--text-muted); margin-left: 6px;">${o.customerName}</span>
          </div>
          <span class="status-badge st-${o.status}">${o.status}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Retirada: <b>${o.pickupLabel}</b> • Tel: ${o.phone}</div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">
          ${o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 800;">${money(o.total)}</span>
          <span class="status-badge" style="background:${o.paymentStatus==='pago'?'#DCFCE7':'#FEF3C7'}; color:${o.paymentStatus==='pago'?'#16A34A':'#D97706'};">
            Pix ${o.paymentStatus==='pago' ? 'recebido ✔' : 'pendente'}
          </span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${o.paymentStatus !== 'pago' ? `<button class="btn btn-outline btn-sm" onclick="confirmPayment('${o.id}')">Marcar Pix recebido</button>` : ''}
          ${nextStatusBtn(o)}
        </div>
      </div>
    `).join('')}
  `;
}

function nextStatusBtn(o){
  const flow = { pendente: 'preparando', preparando: 'pronto', pronto: 'entregue' };
  const label = { pendente: 'Iniciar Preparo', preparando: 'Marcar Pronto', pronto: 'Finalizar Entregue' };
  const next = flow[o.status];
  if(!next) return '';
  return `<button class="btn btn-primary btn-sm" onclick="advanceOrderStatus('${o.id}', '${next}')">${label[o.status]}</button>`;
}

async function advanceOrderStatus(id, nextStatus){
  const order = state.orders.find(x => x.id === id);
  if(order){
    order.status = nextStatus;
    await updateOrderStatusRemote(id, nextStatus);
    playSoundEffect('ding');
    render();
  }
}

async function confirmPayment(id){
  const order = state.orders.find(x => x.id === id);
  if(order){
    order.paymentStatus = 'pago';
    await updatePaymentStatusRemote(id, 'pago');
    playSoundEffect('ding');
    render();
  }
}
