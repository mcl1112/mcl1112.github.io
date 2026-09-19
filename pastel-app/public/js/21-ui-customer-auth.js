// ============================================================
// TELA: LOGIN / CRIAR CONTA DO CLIENTE
// ============================================================
function viewCustomerAuth(){
  const isSignup = state.authMode === 'signup';
  return `
    <header class="topbar">
      <div class="brand"><div class="brand-logo">🥟</div><div><div class="brand-title">Pastel Sem Fila</div></div></div>
      <button class="badge-btn" onclick="backToLogin()">Início</button>
    </header>
    <main>
      <div class="ticket-card" style="max-width: 360px; margin: 24px auto 0;">
        <h3 style="text-align:center; margin-bottom: 4px;">${isSignup ? 'Criar minha conta' : 'Entrar na minha conta'}</h3>
        <p style="text-align:center; font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
          É rapidinho — assim você acompanha o status e o histórico dos seus pedidos.
        </p>

        ${isSignup ? `
          <div class="field"><label>Seu nome</label><input id="auth-name" placeholder="Como podemos te chamar?"></div>
          <div class="field"><label>Telefone / WhatsApp</label><input id="auth-phone" type="tel" placeholder="(11) 99999-9999"></div>
        ` : ''}
        <div class="field"><label>E-mail</label><input id="auth-email" type="email" placeholder="voce@email.com"></div>
        <div class="field"><label>Senha</label><input id="auth-password" type="password" placeholder="mínimo 6 caracteres"></div>

        ${state.authError ? `<p style="color:var(--brand-red); font-size:12.5px; margin-bottom:10px;">${escapeHtml(state.authError)}</p>` : ''}

        <button class="btn btn-primary btn-block" id="authSubmitBtn" onclick="${isSignup ? 'handleSignup()' : 'handleLogin()'}">
          ${isSignup ? 'Criar conta e continuar' : 'Entrar'}
        </button>

        <p style="text-align:center; font-size:13px; margin-top:14px; color:var(--text-muted);">
          ${isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}
          <button class="btn-ghost" style="text-decoration:underline; padding:0;" onclick="switchAuthMode()">
            ${isSignup ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </div>
    </main>
  `;
}

function switchAuthMode(){
  state.authMode = state.authMode === 'signup' ? 'login' : 'signup';
  state.authError = '';
  render();
}

async function handleSignup(){
  const name = document.getElementById('auth-name').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if(!name || !phone || !email || !password){ state.authError = 'Preencha todos os campos.'; render(); return; }
  if(password.length < 6){ state.authError = 'A senha precisa ter pelo menos 6 caracteres.'; render(); return; }

  const btn = document.getElementById('authSubmitBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Criando conta...'; }

  const { error } = await signUpCustomer(email, password, name, phone);
  if(error){
    state.authError = traduzErroAuth(error);
    render();
    return;
  }
  playSoundEffect('ding');
  state.view = 'customer';
  state.step = 1;
  render();
}

async function handleLogin(){
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if(!email || !password){ state.authError = 'Preencha e-mail e senha.'; render(); return; }

  const btn = document.getElementById('authSubmitBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Entrando...'; }

  const { error } = await signInCustomer(email, password);
  if(error){
    state.authError = traduzErroAuth(error);
    render();
    return;
  }
  playSoundEffect('ding');
  state.view = 'customer';
  state.step = 1;
  render();
}

function traduzErroAuth(error){
  const msg = (error && error.message) || '';
  if(msg.includes('already registered') || msg.includes('already exists')) return 'Já existe uma conta com esse e-mail. Tente entrar.';
  if(msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if(msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
  return msg || 'Não foi possível concluir. Tente novamente.';
}

async function handleLogoutCustomer(){
  await signOutCustomer();
  backToLogin();
}
