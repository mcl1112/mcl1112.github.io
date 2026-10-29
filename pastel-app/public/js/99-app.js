// ============================================================
// ROTEADOR DE TELAS + INICIALIZAÇÃO
// ============================================================
function render(){
  const app = document.getElementById('app');
  if(state.view === 'login') app.innerHTML = viewLogin();
  else if(state.view === 'customer-auth') app.innerHTML = viewCustomerAuth();
  else if(state.view === 'customer') app.innerHTML = viewCustomer();
  else if(state.view === 'meus-pedidos') app.innerHTML = viewMyOrders();
  else if(state.view === 'employee-gate') app.innerHTML = viewEmployeeGate();
  else if(state.view === 'employee') app.innerHTML = viewEmployee();
}

async function init(){
  const snd = localStorage.getItem(SOUND_KEY);
  state.soundOn = snd ? snd === 'on' : true;

  await restoreSession();
  await loadConfig();
  await loadMenu();
  await loadPromotions();
  await loadIngredientsAndRecipes();
  await loadCustomConfig();

  render();
}
init();
