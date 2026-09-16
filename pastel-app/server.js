// Servidor simples que só entrega os arquivos estáticos (public/).
// Toda a lógica de dados (pedidos, cardápio, config) fala direto
// com o Supabase pelo navegador — este servidor não guarda nada.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Qualquer rota não encontrada cai no index.html (site de página única)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pastel Sem Fila rodando em http://localhost:${PORT}`);
});
