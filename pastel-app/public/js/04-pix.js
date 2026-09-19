// ============================================================
// PIX — geração do "Copia e Cola" (BR Code / EMV) sem gateway
// ============================================================
// Isso gera um código Pix 100% padrão do Banco Central usando só a
// sua chave Pix (nenhuma conta de gateway, nenhuma taxa, nenhuma API).
// A limitação: como não há um provedor de pagamentos avisando o site
// quando o Pix cai, a confirmação é manual — a equipe marca "pagamento
// recebido" ao ver o Pix entrar no aplicativo do banco. É assim que a
// maioria das barracas/pequenos negócios usa Pix no dia a dia.

function emvField(id, value){
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function pixSanitize(str, maxLen){
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .replace(/[^a-zA-Z0-9 ]/g, '')                      // só letras/números/espaço
    .trim()
    .slice(0, maxLen);
}

// Ajusta a chave Pix pro formato exato que cada tipo de chave exige.
// Chave errada de formato é outra causa comum de "QR Pix inválido".
function normalizePixKey(rawKey, keyType){
  const key = String(rawKey || '').trim();
  if(keyType === 'cpf_cnpj'){
    return key.replace(/\D/g, ''); // só dígitos, sem ponto/traço/barra
  }
  if(keyType === 'telefone'){
    let digits = key.replace(/\D/g, '');
    if(!digits.startsWith('55')) digits = '55' + digits; // código do Brasil
    return '+' + digits;
  }
  if(keyType === 'email'){
    return key.toLowerCase();
  }
  return key; // chave aleatória (EVP): usa como está, é case-sensitive
}

function crc16ccitt(payload){
  let crc = 0xFFFF;
  for(let i = 0; i < payload.length; i++){
    crc ^= (payload.charCodeAt(i) << 8);
    for(let j = 0; j < 8; j++){
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload({ pixKey, merchantName, merchantCity, amount, txid }){
  if(!pixKey) return null;

  const merchantAccountInfo =
    emvField('00', 'br.gov.bcb.pix') +
    emvField('01', pixKey);

  const additionalData = emvField('05', pixSanitize(txid, 25) || '***');

  let payload =
    emvField('00', '01') +
    emvField('01', '11') +
    emvField('26', merchantAccountInfo) +
    emvField('52', '0000') +
    emvField('53', '986') +
    emvField('54', Number(amount).toFixed(2)) +
    emvField('58', 'BR') +
    emvField('59', pixSanitize(merchantName, 25) || 'PASTELARIA') +
    emvField('60', pixSanitize(merchantCity, 15) || 'SAO PAULO') +
    emvField('62', additionalData);

  payload += '6304'; // id + tamanho do campo do CRC (o valor vem a seguir)
  return payload + crc16ccitt(payload);
}

// Monta a URL de uma imagem PNG do QR code, gerada por um serviço público
// (goqr.me / api.qrserver.com — gratuito, sem chave de API). Isso troca a
// dependência de uma biblioteca JS por um simples <img>, que é bem mais
// difícil de quebrar (nada de script de CDN com caminho/versão errada).
// O texto "copia e cola" continua aparecendo do mesmo jeito por baixo,
// então mesmo se essa imagem não carregar (sem internet, por exemplo),
// o pagamento por Pix continua funcionando normalmente.
function pixQrImageUrl(payload){
  return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(payload);
}

function copyPixCode(payload, btnEl){
  navigator.clipboard.writeText(payload).then(()=>{
    if(btnEl){
      const original = btnEl.textContent;
      btnEl.textContent = 'Copiado! ✔';
      setTimeout(()=>{ btnEl.textContent = original; }, 1800);
    }
  }).catch(()=>{ alert('Não foi possível copiar automaticamente — selecione o texto manualmente.'); });
}
