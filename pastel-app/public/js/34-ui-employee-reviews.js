// ============================================================
// EQUIPE: ABA AVALIAÇÃO (feedback dos clientes)
// ============================================================
function empReviewsTab(){
  const reviews = state.reviews || [];
  if(reviews.length === 0){
    return `<div style="text-align:center; padding:40px 10px; color:var(--text-muted);">Nenhuma avaliação recebida ainda.</div>`;
  }
  const avg = reviews.reduce((s,r)=>s+r.rating,0) / reviews.length;
  return `
    <div class="ticket-card" style="text-align:center; margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Nota média</div>
      <div style="font-family:'Fredoka'; font-size:32px;">${avg.toFixed(1)}</div>
      <div>${starsHtml(Math.round(avg), 20)}</div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${reviews.length} avaliação${reviews.length>1?'ões':''}</div>
    </div>
    ${reviews.map(r => `
      <div class="order-card-emp">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700;">${escapeHtml(r.customerName || 'Cliente')}</span>
          <span style="font-size:11px; color:var(--text-muted);">${r.orderCode || ''}</span>
        </div>
        <div style="margin-bottom:6px;">${starsHtml(r.rating, 16)}</div>
        ${r.comment ? `<div style="font-size:13px; color:var(--text-main);">"${escapeHtml(r.comment)}"</div>` : ''}
      </div>
    `).join('')}
  `;
}
