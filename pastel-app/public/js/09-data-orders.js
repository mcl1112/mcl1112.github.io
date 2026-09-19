// ============================================================
// DADOS: PEDIDOS
// ============================================================
async function loadOrders(){
  try{
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at');
    if(error) throw error;
    state.orders = (data || []).map(rowToOrder);
  }catch(e){
    console.warn('Não foi possível carregar pedidos do Supabase.', e);
    state.orders = [];
  }
}
function rowToOrder(row){
  return {
    id: row.id, code: row.code, customerName: row.customer_name, phone: row.phone,
    items: row.items, subtotal: Number(row.subtotal), discount: Number(row.discount),
    total: Number(row.total), slotKey: row.slot_key, pickupLabel: row.pickup_label,
    pickupDayLabel: row.pickup_day_label, status: row.status,
    paymentStatus: row.payment_status || 'pendente', userId: row.user_id,
    createdAt: row.created_at
  };
}
async function insertOrder(order){
  const { error } = await supabaseClient.from('orders').insert({
    id: order.id, code: order.code, customer_name: order.customerName, phone: order.phone,
    items: order.items, subtotal: order.subtotal, discount: order.discount, total: order.total,
    slot_key: order.slotKey, pickup_label: order.pickupLabel, pickup_day_label: order.pickupDayLabel,
    status: order.status, payment_status: order.paymentStatus, user_id: order.userId,
    created_at: order.createdAt
  });
  if(error) console.error('Falha ao salvar pedido no Supabase', error);
  return error;
}
async function updateOrderStatusRemote(id, status){
  const { error } = await supabaseClient.from('orders').update({status}).eq('id', id);
  if(error) console.error('Falha ao atualizar status do pedido no Supabase', error);
}
async function updatePaymentStatusRemote(id, paymentStatus){
  const { error } = await supabaseClient.from('orders').update({payment_status: paymentStatus}).eq('id', id);
  if(error) console.error('Falha ao atualizar status do pagamento no Supabase', error);
}

function myOrders(){
  if(!state.customerUser) return [];
  return state.orders
    .filter(o => o.userId === state.customerUser.id)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

let realtimeChannel = null;
function startOrdersRealtime(onChange){
  stopOrdersRealtime();
  try{
    realtimeChannel = supabaseClient
      .channel('orders-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'orders'}, async ()=>{
        await loadOrders();
        onChange();
      })
      .subscribe();
  }catch(e){ console.warn('Realtime indisponível, esta tela não atualiza sozinha.', e); }
}
function stopOrdersRealtime(){
  if(realtimeChannel){ supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
}
