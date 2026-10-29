// ============================================================
// PEQUENOS AUXILIARES DE INTERFACE COMPARTILHADOS
// ============================================================
function renderImageHtml(src, fallbackEmoji, classAttr=""){
  return `
    <div class="media-box ${classAttr}">
      <img src="${src}" alt="Foto Comida" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="fallback-emoji">${fallbackEmoji || '🥟'}</div>
    </div>
  `;
}

// Vídeo em loop com o mesmo fallback de emoji das imagens — usado no
// banner de destaque (troca o antigo .gif por um .mp4 mais leve).
function renderVideoHtml(src, fallbackEmoji, classAttr=""){
  return `
    <div class="media-box ${classAttr}">
      <video autoplay loop muted playsinline
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <source src="${src}" type="video/mp4">
      </video>
      <div class="fallback-emoji">${fallbackEmoji || '🥟'}</div>
    </div>
  `;
}

// Aviso rápido que some sozinho (mais leve que alert())
function showToast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-hide'), 2600);
  setTimeout(() => el.remove(), 3100);
}

// Emoji para cada ingrediente (pelo nome), só pra deixar as telas mais bonitas
function ingredientEmoji(name){
  const n = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const map = [
    ['camar', '🍤'], ['frango', '🍗'], ['calabresa', '🌭'], ['bacon', '🥓'], ['presunto', '🍖'],
    ['carne', '🥩'], ['catupiry', '🧀'], ['requeijao', '🧀'], ['queijo', '🧀'], ['mussarela', '🧀'],
    ['tomate', '🍅'], ['cebola', '🧅'], ['azeitona', '🫒'], ['milho', '🌽'], ['palmito', '🌴'],
    ['ovo', '🥚'], ['cheiro', '🌿'], ['oregano', '🌿'], ['banana', '🍌'], ['chocolate', '🍫'],
    ['goiabada', '🍬'], ['canela', '🟤'], ['acucar', '🍚'], ['massa', '🫓'], ['oleo', '🛢️'],
    ['coca', '🥤'], ['refri', '🥤'], ['cana', '🥤'], ['suco', '🧃'], ['agua', '💧']
  ];
  for(const [key, emoji] of map){ if(n.includes(key)) return emoji; }
  return '🥣';
}
