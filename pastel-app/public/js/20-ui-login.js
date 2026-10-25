// ============================================================
// TELA 1: ESCOLHA DE PAPEL (cliente / equipe)
// ============================================================
function viewLogin(){
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">🥟</div>
        <div><div class="brand-title">Pastel Sem Fila</div><div class="brand-sub">Sabor & Agilidade</div></div>
      </div>
      <button class="icon-btn" onclick="toggleSound()">${state.soundOn?'🔊':'🔇'}</button>
    </header>
    <main>
      <div class="hero-card">
        <span class="hero-tag">🔥 Crocante, Quentinho & Sem Fila</span>
        <h2>Apenas peça, chegue e retire!</h2>
        <p>Escolha seus pastéis recheados favoritos, defina o horário de retirada e evite esperar no balcão.</p>
        <div class="fry-scene">
          ${renderVideoHtml('assets/videos/banner-destaque.mp4', '🥟')}
          <div class="fry-pastel"></div>
        </div>
      </div>

      <div class="role-grid">
        <button class="role-card" onclick="goCustomer()">
          <div class="role-icon-box">🧾</div>
          <div class="role-info">
            <h3>Fazer meu Pedido</h3>
            <p>Ver cardápio com fotos, escolher itens, pagar no Pix e agendar retirada sem fila.</p>
          </div>
        </button>

        <button class="role-card" onclick="goEmployeeGate()">
          <div class="role-icon-box">👨‍🍳</div>
          <div class="role-info">
            <h3>Área da Equipe</h3>
            <p>Gerenciar pedidos, cardápio, descontos e avaliações.</p>
          </div>
        </button>
      </div>
    </main>
  `;
}

// Pedir pra fazer login/criar conta é obrigatório pra pedir, porque o
// status do pedido e o histórico ficam ligados à conta do cliente.
function goCustomer(){
  playSoundEffect('pop');
  if(state.customerUser){
    state.view = 'customer';
    state.step = 1;
    refreshStockInBackground();
  } else {
    state.authMode = 'login';
    state.authError = '';
    state.view = 'customer-auth';
  }
  render();
}
function goEmployeeGate(){ playSoundEffect('pop'); state.view='employee-gate'; state.passcodeInput=''; state.passcodeError=false; render(); }

function backToLogin(){
  state.view = 'login';
  state.step = 1;
  state.cart = {};
  stopOrdersRealtime();
  render();
}
