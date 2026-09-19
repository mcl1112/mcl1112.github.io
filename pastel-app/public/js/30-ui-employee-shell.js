// ============================================================
// EQUIPE: PORTÃO DE ACESSO + ESTRUTURA DAS ABAS
// ============================================================
function viewEmployeeGate(){
  return `
    <header class="topbar">
      <div class="brand"><div class="brand-logo">👨‍🍳</div><div><div class="brand-title">Equipe</div></div></div>
      <button class="badge-btn" onclick="backToLogin()">Sair</button>
    </header>
    <main>
      <div class="ticket-card" style="max-width: 320px; margin: 40px auto 0;">
        <h3 style="text-align: center; margin-bottom: 14px;">Acesso Restrito</h3>
        <div class="field">
          <label>Senha de Acesso</label>
          <input type="password" id="passInput" value="${state.passcodeInput}" oninput="state.passcodeInput=this.value" onkeydown="if(event.key==='Enter')checkPasscode()">
        </div>
        ${state.passcodeError ? `<p style="color: var(--brand-red); font-size: 12px; margin-bottom: 10px;">Senha incorreta (Padrão: 1234)</p>` : ''}
        <button class="btn btn-primary btn-block" onclick="checkPasscode()">Entrar no Painel</button>
      </div>
    </main>
  `;
}

function checkPasscode(){
  if(state.passcodeInput === EMPLOYEE_PASSCODE){
    playSoundEffect('ding');
    state.view = 'employee';
    state.empTab = 'pedidos';
    enterEmployeeDashboard();
  } else {
    playSoundEffect('error');
    state.passcodeError = true;
    render();
  }
}
async function enterEmployeeDashboard(){
  await Promise.all([loadOrders(), loadPromotions(), loadReviews()]);
  render();
  startOrdersRealtime(() => { if(state.view === 'employee') render(); });
}

function viewEmployee(){
  return `
    <header class="topbar">
      <div class="brand"><div class="brand-logo">👨‍🍳</div><div><div class="brand-title">Painel Cozinha</div></div></div>
      <button class="badge-btn" onclick="backToLogin()">Sair</button>
    </header>
    <main>
      <div class="tabs-bar">
        <button class="tab-item ${state.empTab==='pedidos'?'active':''}" onclick="setEmpTab('pedidos')">Pedidos</button>
        <button class="tab-item ${state.empTab==='cardapio'?'active':''}" onclick="setEmpTab('cardapio')">Cardápio</button>
        <button class="tab-item ${state.empTab==='descontos'?'active':''}" onclick="setEmpTab('descontos')">Descontos</button>
        <button class="tab-item ${state.empTab==='avaliacao'?'active':''}" onclick="setEmpTab('avaliacao')">Avaliação</button>
        <button class="tab-item ${state.empTab==='config'?'active':''}" onclick="setEmpTab('config')">Config</button>
      </div>

      ${state.empTab === 'pedidos' ? empOrdersTab() : ''}
      ${state.empTab === 'cardapio' ? empMenuTab() : ''}
      ${state.empTab === 'descontos' ? empDiscountsTab() : ''}
      ${state.empTab === 'avaliacao' ? empReviewsTab() : ''}
      ${state.empTab === 'config' ? empConfigTab() : ''}
    </main>
  `;
}

function setEmpTab(t){ playSoundEffect('pop'); state.empTab = t; render(); }
