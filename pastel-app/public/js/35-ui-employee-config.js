// ============================================================
// EQUIPE: ABA CONFIGURAÇÕES (horários + chave Pix)
// ============================================================
function empConfigTab(){
  const c = state.config;
  return `
    <div class="ticket-card">
      <h4 style="margin-bottom: 12px;">Configurações de Horário</h4>
      <div class="field">
        <label>Limite de Pedidos por Slot</label>
        <input type="number" id="cfg-max" value="${c.maxPerSlot}">
      </div>
      <div class="field">
        <label>Intervalo dos Slots (Minutos)</label>
        <input type="number" id="cfg-interval" value="${c.slotInterval}">
      </div>
      <div class="field">
        <label>Antecedência Mínima (Minutos)</label>
        <input type="number" id="cfg-lead" value="${c.minLead}">
      </div>
    </div>

    <div class="ticket-card">
      <h4 style="margin-bottom: 4px;">Recebimento por Pix</h4>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
        Gera um QR code Pix de verdade pro cliente pagar, usando sua própria chave —
        sem taxas e sem precisar de conta em gateway de pagamento. A confirmação de
        que o dinheiro caiu é manual: você mesmo marca "Pix recebido" na aba Pedidos
        depois de ver a entrada no seu banco.
      </p>
      <div class="field">
        <label>Tipo da sua chave Pix</label>
        <select id="cfg-pixkeytype">
          <option value="cpf_cnpj" ${c.pixKeyType==='cpf_cnpj'?'selected':''}>CPF ou CNPJ</option>
          <option value="telefone" ${c.pixKeyType==='telefone'?'selected':''}>Telefone</option>
          <option value="email" ${c.pixKeyType==='email'?'selected':''}>E-mail</option>
          <option value="aleatoria" ${c.pixKeyType==='aleatoria'?'selected':''}>Chave aleatória</option>
        </select>
      </div>
      <div class="field">
        <label>Sua chave Pix</label>
        <input id="cfg-pixkey" value="${escapeHtml(c.pixKey||'')}" placeholder="ex: 11999998888 (só números, sem +55, sem espaço)">
        <small style="display:block; font-size:11.5px; color:var(--text-muted); margin-top:4px;">
          Digite igual está cadastrada no banco: CPF/CNPJ só números, telefone com DDD sem +55
          (o site adiciona sozinho), e-mail normal, ou cole a chave aleatória inteira.
        </small>
      </div>
      <div class="field">
        <label>Nome do recebedor (máx. 25 caracteres, sem acento)</label>
        <input id="cfg-merchant-name" value="${escapeHtml(c.merchantName||'')}" maxlength="25">
      </div>
      <div class="field">
        <label>Cidade (máx. 15 caracteres, sem acento)</label>
        <input id="cfg-merchant-city" value="${escapeHtml(c.merchantCity||'')}" maxlength="15">
      </div>
    </div>

    <button class="btn btn-primary btn-block" onclick="saveSettings()">Salvar Ajustes</button>
  `;
}

async function saveSettings(){
  state.config.maxPerSlot = parseInt(document.getElementById('cfg-max').value) || 5;
  state.config.slotInterval = parseInt(document.getElementById('cfg-interval').value) || 15;
  state.config.minLead = parseInt(document.getElementById('cfg-lead').value) || 20;
  state.config.pixKey = document.getElementById('cfg-pixkey').value.trim();
  state.config.pixKeyType = document.getElementById('cfg-pixkeytype').value;
  state.config.merchantName = document.getElementById('cfg-merchant-name').value.trim() || 'Pastelaria';
  state.config.merchantCity = document.getElementById('cfg-merchant-city').value.trim() || 'Sao Paulo';
  await saveConfig();
  playSoundEffect('ding');
  alert('Configurações salvas!');
  render();
}
