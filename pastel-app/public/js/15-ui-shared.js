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
