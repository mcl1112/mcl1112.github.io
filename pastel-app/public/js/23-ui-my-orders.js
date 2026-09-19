// ============================================================
// TELA: MEUS PEDIDOS (status + pagamento + avaliação)
// ============================================================
async function goMyOrders(){
  playSoundEffect('pop');
  state.view = 'meus-pedidos';
  render();
  await loadOrders();
  await loadReviews();
  render();
  startOrdersRealtime(render);
}

const STATUS_LABEL = { pendente:'Pendente', preparando:'Preparando', pronto:'Pronto para retirar', entregue:'Retirado' };

function viewMyOrders(){
  const orders = myOrders();
  return `
    ${customerHeader()}
    <main>
      <h2 style="font-size:20px; margin-bottom:14px;">Meus Pedidos</h2>
      ${orders.length === 0 ? `
        <div style="text-align:center; padding:40px 10px; color:var(--text-muted);">
          Você ainda não fez nenhum pedido.<br><br>
          <button class="btn btn-primary" onclick="goStep(1); state.view='customer'; render();">Fazer meu primeiro pedido</button>
        </div>
      ` : orders.map(myOrderCard).join('')}

      <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="state.view='customer'; state.step=1; render();">← Voltar ao cardápio</button>
    </main>
    ${state.reviewingOrderId ? reviewModalHtml() : ''}
  `;
}

function myOrderCard(o){
  const canReview = o.status === 'entregue' && !hasReviewForOrder(o.id);
  return `
    <div class="order-card-emp">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
        <div>
          <span style="font-weight:800; font-size:16px;">${o.code}</span>
          <span style="font-size:12px; color:var(--text-muted); margin-left:6px;">${o.pickupDayLabel} às ${o.pickupLabel}</span>
        </div>
        <span class="status-badge st-${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
      </div>
      <div style="font-size:13px; margin-bottom:8px;">${o.items.map(i=>`${i.qty}x ${i.name}`).join(', ')}</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800;">${money(o.total)}</span>
        <span class="status-badge" style="background:${o.paymentStatus==='pago'?'#DCFCE7':'#FEF3C7'}; color:${o.paymentStatus==='pago'?'#16A34A':'#D97706'};">
          Pix: ${o.paymentStatus==='pago' ? 'Pago ✔' : 'Pendente'}
        </span>
      </div>
      ${canReview ? `<button class="btn btn-primary btn-sm btn-block" style="margin-top:10px;" onclick="openReviewModal('${o.id}','${o.code}')">⭐ Avaliar este pedido</button>` : ''}
      ${hasReviewForOrder(o.id) ? `<p style="font-size:12px; color:var(--success); margin-top:8px; font-weight:700;">Obrigado pela avaliação! ✔</p>` : ''}
    </div>
  `;
}

function openReviewModal(orderId, orderCode){
  state.reviewingOrderId = orderId;
  state.reviewingOrderCode = orderCode;
  state.reviewDraft = { rating: 5, comment: '' };
  render();
}
function closeReviewModal(){
  state.reviewingOrderId = null;
  render();
}
function setReviewRating(n){
  state.reviewDraft.rating = n;
  render();
}

function reviewModalHtml(){
  return `
    <div style="position:fixed; inset:0; background:rgba(17,24,39,0.6); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px;">
      <div class="ticket-card" style="max-width:360px; width:100%;">
        <h3 style="margin-bottom:4px;">Avaliar pedido ${state.reviewingOrderCode}</h3>
        <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">Como foi sua experiência?</p>
        <div style="text-align:center; margin-bottom:14px;">
          ${[1,2,3,4,5].map(n => `<span style="cursor:pointer; font-size:30px; color:${n<=state.reviewDraft.rating?'#FFB800':'#E5E7EB'};" onclick="setReviewRating(${n})">★</span>`).join('')}
        </div>
        <div class="field">
          <label>Comentário (opcional)</label>
          <input id="review-comment" value="${escapeHtml(state.reviewDraft.comment)}" placeholder="O que você achou do pastel?">
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline" style="flex:1;" onclick="closeReviewModal()">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="submitReview()">Enviar</button>
        </div>
      </div>
    </div>
  `;
}

async function submitReview(){
  const comment = document.getElementById('review-comment').value.trim();
  const review = {
    id: 'r' + Date.now().toString(36),
    orderId: state.reviewingOrderId,
    orderCode: state.reviewingOrderCode,
    userId: state.customerUser ? state.customerUser.id : null,
    customerName: state.customerProfile ? state.customerProfile.name : (state.customer.name || 'Cliente'),
    rating: state.reviewDraft.rating,
    comment,
    createdAt: new Date().toISOString()
  };
  const err = await insertReview(review);
  if(err){ alert('Não foi possível enviar sua avaliação agora. Tente novamente.'); return; }
  playSoundEffect('ding');
  state.reviewingOrderId = null;
  render();
}
