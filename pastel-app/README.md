# Pastel Sem Fila

Site de pedidos de pastel com retirada agendada, cardápio editável pela
equipe e agora com backend real (Supabase), pronto para virar um projeto
Node.js e, na sequência, um app Android (.apk).

## O que mudou em relação ao arquivo único anterior

- Nada da interface, das animações, dos sons ou das regras de horário/vagas
  foi alterado — é o mesmo código que você tinha, só reorganizado em arquivos
  separados (`index.html`, `style.css`, `app.js`).
- A única mudança real de comportamento é **onde os dados moram**: antes era
  `window.storage` (memória do artefato do Claude); agora é o **Supabase**
  (`config`, `menu_items`, `orders`), então os dados sobrevivem fora do chat,
  em qualquer navegador ou no app instalado.
- Bônus: o painel da equipe agora atualiza sozinho por **Realtime** do
  Supabase em vez de ficar re-consultando a cada X segundos.

## Estrutura do projeto

```
pastel-app/
├── package.json
├── server.js              -> servidor Node/Express (só serve os arquivos)
├── capacitor.config.json  -> configuração para gerar o app Android
├── supabase/
│   └── schema.sql         -> script para criar as tabelas no Supabase
└── public/
    ├── index.html
    ├── style.css
    ├── supabase-config.js -> AQUI você cola suas credenciais do Supabase
    ├── app.js
    └── assets/
        ├── images/        -> fotos e gifs do cardápio (você adiciona)
        └── sounds/        -> efeitos sonoros (você adiciona)
```

## 1. Rodar localmente com Node

```bash
npm install
npm start
```

Abra http://localhost:3000 no navegador.

## 2. Configurar o Supabase (banco de dados real)

1. Crie uma conta e um projeto grátis em https://supabase.com
2. No painel do projeto, abra **SQL Editor** → cole o conteúdo de
   `supabase/schema.sql` → **Run**. Isso cria as tabelas `config`,
   `menu_items` e `orders` (e já popula a config padrão).
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave
   **anon public**.
4. Abra `public/supabase-config.js` e cole os dois valores no lugar de
   `COLE_AQUI_A_URL_DO_SEU_PROJETO` e `COLE_AQUI_A_CHAVE_ANON_PUBLIC`.
5. (Opcional, mas recomendado) Em **Database → Replication**, ative o
   Realtime para a tabela `orders` — é o que faz o painel da equipe
   atualizar sozinho quando chega um pedido novo.
6. O cardápio padrão (os 8 itens que já existiam) é inserido automaticamente
   na primeira vez que alguém abrir o site, se a tabela `menu_items` estiver
   vazia.

⚠️ **Sobre segurança**: as políticas em `schema.sql` liberam leitura e
escrita para qualquer pessoa que tenha a chave anon (que é pública, fica
no `supabase-config.js`). Isso reproduz o mesmo nível de proteção que o
site já tinha — a senha "1234" da equipe é só uma trava de tela, não uma
trava de banco. Antes de divulgar o site publicamente, vale a pena estudar
o **Supabase Auth** para transformar isso numa proteção de verdade (só
quem faz login como funcionário consegue alterar pedidos/cardápio/config).

## 3. Adicionar suas imagens, gifs e sons

O código já está preparado para usar arquivos reais e cair automaticamente
no emoji/som sintetizado se o arquivo não existir. Salve os arquivos dentro
de `public/assets/` com estes nomes (ou ajuste o campo "Caminho Imagem" de
cada item na aba Cardápio da equipe):

| Pasta                    | Arquivo                          | Onde aparece                          |
|---------------------------|-----------------------------------|----------------------------------------|
| assets/images/            | pastel-carne.jpg                  | Pastel de Carne Especial               |
| assets/images/            | pastel-queijo.jpg                 | Pastel de Queijo Puxa-Fio              |
| assets/images/            | pastel-frango-catupiry.jpg        | Frango Cremoso c/ Catupiry             |
| assets/images/            | pastel-pizza.jpg                  | Pastel de Pizza Especial               |
| assets/images/            | pastel-palmito.jpg                | Pastel de Palmito Especial             |
| assets/images/            | pastel-chocolate-banana.jpg       | Chocolate com Banana                   |
| assets/images/            | caldo-de-cana.jpg                 | Caldo de Cana 300ml                    |
| assets/images/            | refrigerante-lata.jpg             | Refrigerante Lata 350ml                |
| assets/images/            | banner-destaque.gif               | Banner animado da tela inicial         |
| assets/sounds/            | pop.mp3                           | Adicionar item à sacola                |
| assets/sounds/            | fizz.mp3                          | (reservado para efeito de bebida)      |
| assets/sounds/            | chime.mp3                         | Pedido confirmado                      |
| assets/sounds/            | ding.mp3                          | Senha certa / status avançado / config salva |
| assets/sounds/            | error.mp3                         | Senha da equipe incorreta              |

Itens novos que a equipe cadastrar pela aba **Cardápio** também podem
apontar para qualquer arquivo dentro de `assets/images/`.

## 4. Gerar o APK Android (Capacitor)

Isto precisa ser feito na sua máquina com **Node.js** e o **Android
Studio** (com o Android SDK) instalados — não é algo que eu consiga
compilar aqui.

```bash
npm install
npx cap init "Pastel Sem Fila" "com.pastelsemfila.app" --web-dir=public
npx cap add android
npx cap sync
npx cap open android
```

O último comando abre o projeto no Android Studio. De lá:
**Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Como o app fala direto com o Supabase pela internet, ele funciona no
celular exatamente como no navegador — não precisa do `server.js` rodando
dentro do app (esse servidor Node é só para você testar no computador ou,
se quiser, hospedar o mesmo site na web).

## 5. Onde tudo mora, resumido

- **Interface e regras de negócio** (horários, vagas, combo, sons,
  animações): `public/app.js` — inalterado na lógica, só trocando de onde
  vêm os dados.
- **Banco de dados**: Supabase (`config`, `menu_items`, `orders`).
- **Servidor Node**: só entrega os arquivos estáticos.
- **App Android**: o mesmo `public/` empacotado pelo Capacitor.
