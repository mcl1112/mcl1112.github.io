// ============================================================
// ESTADO GLOBAL E CONSTANTES
// (arquivo carregado logo depois do supabase-config.js)
// ============================================================
const SOUND_KEY = 'pastelaria-sound-v2';
const EMPLOYEE_PASSCODE = '1234';

const DEFAULT_CONFIG = {
  slotInterval: 15,
  maxPerSlot: 5,
  minLead: 20,
  openHour: 11, openMinute: 0,
  closeHour: 21, closeMinute: 0,
  maxDaysAhead: 2,
  pixKey: '',
  pixKeyType: 'cpf_cnpj', // cpf_cnpj | telefone | email | aleatoria
  merchantName: 'Pastelaria',
  merchantCity: 'Sao Paulo'
};

const DEFAULT_MENU = [
  {id:'m1', cat:'Salgados', name:'Pastel de Carne Especial', desc:'Recheio farto de carne moída temperada com especiarias e azeitonas, extremamente suculento.', price:9.90, emoji:'🥟', image:'assets/images/pastel-carne.jpg', highlight:true, badge:'🔥 Mais Vendido', active:true},
  {id:'m2', cat:'Salgados', name:'Pastel de Queijo Puxa-Fio', desc:'Muita mussarela de primeira qualidade derretida puxando fio a cada mordida crocante.', price:8.90, emoji:'🧀', image:'assets/images/pastel-queijo.jpg', highlight:true, badge:'🧀 Muito Queijo', active:true},
  {id:'m3', cat:'Salgados', name:'Frango Cremoso c/ Catupiry', desc:'Peito de frango desfiado temperadinho combinado com o autêntico Catupiry cremoso.', price:10.90, emoji:'🍗', image:'assets/images/pastel-frango-catupiry.jpg', highlight:true, badge:'⭐ O Favorito', active:true},
  {id:'m4', cat:'Salgados', name:'Pastel de Pizza Especial', desc:'Presunto fatiado, mussarela derretida, orégano fresco e rodelas de tomate.', price:10.90, emoji:'🍕', image:'assets/images/pastel-pizza.jpg', highlight:false, badge:'', active:true},
  {id:'m5', cat:'Salgados', name:'Pastel de Palmito Especial', desc:'Palmito nobre em pedaços com molho branco super cremoso e cheiro verde.', price:9.90, emoji:'🌿', image:'assets/images/pastel-palmito.jpg', highlight:false, badge:'', active:true},
  {id:'m6', cat:'Doces', name:'Chocolate com Banana', desc:'Chocolate ao leite derretido com rodelas de banana, polvilhado com açúcar e canela.', price:9.90, emoji:'🍫', image:'assets/images/pastel-chocolate-banana.jpg', highlight:true, badge:'🍫 Irresistível', active:true},
  {id:'m7', cat:'Bebidas', name:'Caldo de Cana 300ml', desc:'Extraído na hora, trincando de gelado. O parceiro perfeito do pastel!', price:6.00, emoji:'🥤', image:'assets/images/caldo-de-cana.jpg', highlight:false, badge:'', active:true},
  {id:'m8', cat:'Bebidas', name:'Refrigerante Lata 350ml', desc:'Lata trincando de gelada pra descer perfeito.', price:6.00, emoji:'🥫', image:'assets/images/refrigerante-lata.jpg', highlight:false, badge:'', active:true}
];

// Promoção padrão: reproduz exatamente a regra fixa que o site já tinha
// (2 salgados + 1 bebida = R$2 de desconto), agora editável pela equipe.
const DEFAULT_PROMOTIONS = [
  {id:'p1', type:'combo', name:'Combo 2x1 Pastelaria', active:true, cat_a:'Salgados', qty_a:2, cat_b:'Bebidas', qty_b:1, min_subtotal:null, value:2}
];

let state = {
  config: {...DEFAULT_CONFIG},
  menu: [],
  promotions: [],
  ingredients: [],        // estoque: ingredientes
  recipes: [],            // estoque: linhas de receita {menuItemId, ingredientId, quantity}
  orders: [],
  reviews: [],
  view: 'login',        // login | customer-auth | customer | meus-pedidos | employee-gate | employee
  step: 1,               // 1: Cardápio, 2: Sacola, 3: Horário, 4: Confirmado
  empTab: 'pedidos',
  cart: {},               // { itemId: qty }
  customer: {name:'', phone:''},
  customerUser: null,     // usuário logado (auth.users), null = deslogado
  customerProfile: null,  // { id, name, phone }
  authMode: 'login',      // 'login' | 'signup' (tela de conta do cliente)
  authError: '',
  selectedDate: null,
  selectedSlotKey: null,
  lastOrder: null,
  slotsCache: [],
  passcodeInput: '',
  passcodeError: false,
  empSelectedDateStr: null,
  editingItemId: null,
  addingItem: false,
  editingPromoId: null,
  addingPromo: false,
  customSettings: { active: false, doughId: null },  // pastel personalizado: ligado? qual ingrediente é a massa
  customSizes: [],            // [{id, name, basePrice, factor, doughQty, sort}]
  customCart: [],             // sacola: [{uid, sizeId, ingredientIds: [], qty}]
  builderOpen: false,         // cliente: montando o pastel?
  builder: { sizeId: null, ingredientIds: [], qty: 1 },
  stockSearch: '',            // aba Estoque: busca
  editingCustomIngId: null,   // aba Estoque > Personalizado
  editingSizes: false,
  sizesDraft: null,
  stockView: 'produtos',      // aba Estoque: 'produtos' | 'ingredientes' | 'personalizado'
  addingIngredient: false,
  editingIngredientId: null,
  restocking: null,           // { kind: 'ingredient' | 'item', id }
  editingStockItemId: null,
  stockDraft: null,           // { mode, qty, lines: [{ingredientId, quantity}] }
  reviewingOrderId: null,
  reviewDraft: {rating:5, comment:''},
  soundOn: true
};
