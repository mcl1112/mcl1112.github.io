// ============================================================
// DADOS: AVALIAÇÕES (aba "Avaliação" da equipe + "Meus Pedidos")
// ============================================================
async function loadReviews(){
  try{
    const { data, error } = await supabaseClient.from('reviews').select('*').order('created_at', {ascending:false});
    if(error) throw error;
    state.reviews = (data || []).map(rowToReview);
  }catch(e){
    console.warn('Não foi possível carregar avaliações do Supabase.', e);
    state.reviews = [];
  }
}
function rowToReview(row){
  return {
    id: row.id, orderId: row.order_id, orderCode: row.order_code, userId: row.user_id,
    customerName: row.customer_name, rating: row.rating, comment: row.comment,
    createdAt: row.created_at
  };
}
function hasReviewForOrder(orderId){
  return state.reviews.some(r => r.orderId === orderId);
}
async function insertReview(review){
  const { error } = await supabaseClient.from('reviews').insert({
    id: review.id, order_id: review.orderId, order_code: review.orderCode,
    user_id: review.userId, customer_name: review.customerName,
    rating: review.rating, comment: review.comment, created_at: review.createdAt
  });
  if(error) console.error('Falha ao salvar avaliação no Supabase', error);
  else state.reviews.unshift(review);
  return error;
}
