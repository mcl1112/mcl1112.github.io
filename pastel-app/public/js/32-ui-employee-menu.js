// ============================================================
// EQUIPE: ABA CARDÁPIO
// ============================================================
function empMenuTab(){
  return `
    <button class="btn btn-primary btn-block" style="margin-bottom: 14px;" onclick="state.addingItem=true; state.editingItemId=null; render();">+ Adicionar Novo Item</button>

    ${state.addingItem ? renderItemForm() : ''}

    ${state.menu.map(item => state.editingItemId === item.id ? renderItemForm(item) : `
      <div class="order-card-emp" style="${item.active === false ? 'opacity: 0.5;' : ''}">
        <div style="display: flex; gap: 10px; align-items: center;">
          ${renderImageHtml(item.image, item.emoji, 'food-thumb')}
          <div style="flex: 1;">
            <div style="font-weight: 700;">${item.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${item.cat} • ${money(item.price)}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
          <button class="btn btn-outline btn-sm" onclick="toggleActiveItem('${item.id}')">${item.active===false?'Ativar':'Desativar'}</button>
          <button class="btn btn-outline btn-sm" onclick="state.editingItemId='${item.id}'; state.addingItem=false; render();">Editar</button>
          <button class="btn btn-sm" style="background: var(--brand-red); color: #FFF;" onclick="deleteMenuItem('${item.id}')">Excluir</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderItemForm(item){
  const f = item || { name:'', cat:'Salgados', desc:'', price:'', emoji:'🥟', image:'', highlight:false, badge:'' };
  return `
    <div class="ticket-card">
      <h4>${item ? 'Editar Item' : 'Novo Item'}</h4>
      <div class="field"><label>Nome</label><input id="if-name" value="${f.name}"></div>
      <div class="field"><label>Categoria</label><input id="if-cat" value="${f.cat}"></div>
      <div class="field"><label>Descrição</label><input id="if-desc" value="${f.desc}"></div>
      <div class="field"><label>Preço (R$)</label><input id="if-price" type="number" step="0.10" value="${f.price}"></div>
      <div class="field"><label>Caminho Imagem (assets/images/nome.jpg)</label><input id="if-img" value="${f.image || ''}"></div>
      <div class="field"><label>Selo / Badge (Ex: 🔥 Mais Vendido)</label><input id="if-badge" value="${f.badge || ''}"></div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-outline" onclick="state.addingItem=false; state.editingItemId=null; render();">Cancelar</button>
        <button class="btn btn-primary" onclick="saveItemForm('${item?item.id:''}')">Salvar Item</button>
      </div>
    </div>
  `;
}

async function saveItemForm(id){
  const name = document.getElementById('if-name').value.trim();
  const cat = document.getElementById('if-cat').value.trim() || 'Outros';
  const desc = document.getElementById('if-desc').value.trim();
  const price = parseFloat(document.getElementById('if-price').value) || 0;
  const image = document.getElementById('if-img').value.trim();
  const badge = document.getElementById('if-badge').value.trim();

  if(!name){ alert('Nome é obrigatório'); return; }

  let item;
  if(id){
    item = state.menu.find(m => m.id === id);
    if(item) Object.assign(item, { name, cat, desc, price, image, badge });
  } else {
    item = { id:'m'+Date.now().toString(36), name, cat, desc, price, image, badge, active:true, emoji:'🥟', highlight:!!badge };
    state.menu.push(item);
  }

  await saveMenuItem(item);
  state.addingItem = false;
  state.editingItemId = null;
  playSoundEffect('ding');
  render();
}

async function toggleActiveItem(id){
  const item = state.menu.find(m => m.id === id);
  if(item){ item.active = !item.active; await saveMenuItem(item); render(); }
}

async function deleteMenuItem(id){
  if(!confirm('Excluir item do cardápio?')) return;
  state.menu = state.menu.filter(m => m.id !== id);
  await deleteMenuItemRemote(id);
  render();
}
