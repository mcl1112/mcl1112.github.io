# Pastel Sem Fila

Site de pedidos de pastel com retirada agendada, contas de cliente, pagamento
via Pix, cardápio/descontos editáveis pela equipe e avaliações — rodando em
Node.js, com Supabase de backend, pronto para virar um app Android (.apk).

## Estrutura do projeto

```
pastel-app/
├── package.json
├── server.js
├── capacitor.config.json
├── supabase/
│   ├── schema.sql                                  -> schema original (rode primeiro, se ainda não rodou)
│   ├── migration-contas-pix-descontos-avaliacoes.sql -> rode depois do schema.sql
│   ├── migration-tipo-chave-pix.sql                  -> tipo da chave Pix
│   └── migration-estoque.sql                         -> NOVO: estoque (rode por último)
└── public/
    ├── index.html
    ├── style.css
    ├── assets/{images,sounds,videos}/   -> banner-destaque.mp4 vai em assets/videos/
    └── js/
        ├── supabase-config.js        -> suas credenciais
        ├── 01-state.js               -> estado global e constantes
        ├── 02-utils.js               -> formatação, datas, horários
        ├── 03-sound.js               -> efeitos sonoros
        ├── 04-pix.js                 -> gerador de QR Pix (BR Code)
        ├── 05-data-config.js         -> config da loja + chave Pix
        ├── 06-data-menu.js           -> cardápio
        ├── 07-data-promotions.js     -> promoções/combos + cálculo da sacola
        ├── 08-data-auth.js           -> conta do cliente (login/cadastro)
        ├── 09-data-orders.js         -> pedidos + status de pagamento
        ├── 10-data-reviews.js        -> avaliações
        ├── 11-data-stock.js          -> estoque: ingredientes, receitas, disponibilidade, baixa
        ├── 15-ui-shared.js           -> helper de imagem com fallback
        ├── 20-ui-login.js            -> escolha cliente/equipe
        ├── 21-ui-customer-auth.js    -> tela de login/cadastro do cliente
        ├── 22-ui-customer.js         -> cardápio → sacola → horário → confirmação (+ Pix)
        ├── 23-ui-my-orders.js        -> "Meus Pedidos" + avaliação
        ├── 30-ui-employee-shell.js   -> portão de acesso + abas da equipe
        ├── 31-ui-employee-orders.js  -> aba Pedidos (+ confirmar Pix)
        ├── 32-ui-employee-menu.js    -> aba Cardápio
        ├── 33-ui-employee-discounts.js -> aba Descontos (NOVA)
        ├── 34-ui-employee-reviews.js -> aba Avaliação (NOVA)
        ├── 35-ui-employee-config.js  -> aba Config (+ chave Pix)
        ├── 36-ui-employee-stock.js   -> aba Estoque (NOVA)
        └── 99-app.js                 -> roteador de telas + inicialização
```

Por que separei assim: cada arquivo de `data-*` só fala com o Supabase
(nada de HTML dentro deles); cada arquivo de `ui-*` só monta telas (e usa
as funções de `data-*` para ler/gravar); `01-state.js` guarda o estado que
todo mundo compartilha. Quando for pedir a próxima funcionalidade, isso
facilita — mexe só no arquivo do assunto, sem precisar reler um arquivo
gigante inteiro.

## 1. Rodar localmente

```bash
npm install
npm start
```
Abra http://localhost:3000

## 2. Banco de dados (Supabase)

1. Se este é um projeto Supabase **novo**: rode `supabase/schema.sql` inteiro no SQL Editor.
2. Rode `supabase/migration-contas-pix-descontos-avaliacoes.sql` inteiro também (cria contas, Pix, descontos e avaliações).
3. **Importante:** vá em **Authentication → Settings** e desligue **"Confirm email"**. Sem isso, o cliente cria a conta mas fica sem sessão ativa até clicar num link de confirmação por e-mail, e o app não consegue ligar o primeiro pedido à conta dele.
4. Em **Database → Replication**, confirme que a tabela `orders` tem Realtime ativado (já deve estar, do passo anterior).
5. Suas credenciais continuam em `public/js/supabase-config.js`.

## 3. Configurar o Pix

Na aba **Config** do painel da equipe (senha padrão `1234`), preencha:
- **Tipo da chave** (CPF/CNPJ, telefone, e-mail ou aleatória) — o site formata a chave certinho sozinho a partir disso (ex: adiciona o +55 do telefone automaticamente)
- **Sua chave Pix**, digitada sem formatação (só números pra CPF/CNPJ/telefone)
- **Nome do recebedor** e **Cidade** (sem acento, acentos são removidos automaticamente se você digitar)

Antes de usar, rode também `supabase/migration-tipo-chave-pix.sql` no SQL Editor (adiciona a coluninha do tipo de chave).

Pronto — todo pedido novo já mostra um QR code Pix real (o código em si é
gerado no navegador; a imagem do QR é desenhada por um serviço gratuito
sem chave de API, api.qrserver.com), sem nenhuma conta de gateway de
pagamento e sem taxa nenhuma.

**Limitação importante, de forma transparente:** como não existe um gateway
avisando o site quando o Pix cai (isso exigiria criar conta em um provedor
como Mercado Pago, Efí, Asaas etc. e configurar webhooks), a confirmação é
manual — a equipe marca **"Marcar Pix recebido"** na aba Pedidos depois de
ver a entrada no aplicativo do banco. O cliente vê esse status atualizado
em "Meus Pedidos". Se no futuro você quiser confirmação 100% automática,
me avise — dá pra integrar uma dessas APIs depois, sem jogar fora nada do
que já existe.

## 4. Contas de cliente

Agora é preciso criar conta (e-mail + senha + nome + telefone) para fazer
um pedido. Isso o liga à conta pra sempre aparecer em **Meus Pedidos**, com
status do preparo e do pagamento em tempo real, e permite avaliar o pedido
depois que ele é retirado.

A área da equipe **não muda** — continua sendo só a senha `1234` (não usa
o sistema de login do cliente). Se um dia você quiser um login de
verdade pra equipe também (mais seguro), é um próximo passo natural.

## 5. Descontos e combos

Na aba **Descontos** da equipe: crie promoções de 3 tipos —
- **Combo**: "leve X de uma categoria + Y de outra, ganhe R$ de desconto"
  (a promoção "Combo 2x1 Pastelaria" que já existia foi migrada pra cá
  automaticamente, continua funcionando igual).
- **% sobre o pedido** (com valor mínimo opcional)
- **R$ fixo de desconto** (com valor mínimo opcional)

Pode ter várias ativas ao mesmo tempo — todas se somam no carrinho do
cliente, que também vê um resumo das promoções vigentes no cardápio.

## 6. Avaliações

Quando um pedido chega ao status "Retirado" (entregue), o cliente vê um
botão "Avaliar" em Meus Pedidos (estrelas de 1 a 5 + comentário opcional).
A equipe vê tudo isso na aba **Avaliação**, com nota média no topo.

## 8. Estoque (aba "Estoque" da equipe)

**Rode antes:** `supabase/migration-estoque.sql` no SQL Editor do Supabase.

A aba tem duas telas:

- **Ingredientes** — o que você tem guardado (massa, carne, queijo, camarão...), com
  unidade (g, kg, ml, L, un). Botão **+ Repor** soma ao que já existe; **Editar** corrige o total.
  Ingredientes compartilhados (a massa!) são cadastrados uma vez só.
- **Produtos** — cada item do cardápio, com 3 modos:
  - **Não controlar** (padrão): o item fica sempre disponível. Nada muda até você configurar.
  - **Por receita** (pastéis): você diz quanto de cada ingrediente vai em 1 unidade.
  - **Estoque direto** (bebidas de revenda): só a quantidade de unidades (ex: 24 Cocas).

**Exemplo — "tenho ingredientes para 100 pastéis de carne":**
1. Ingredientes → cadastre `Massa de pastel` = 100 un e `Carne moída` = 6000 g.
2. Produtos → Pastel de Carne → Controlar estoque → Por receita → `1 un` de Massa + `60 g` de Carne.
3. Pronto: o card mostra **"Dá pra fazer: 100"** e quem está limitando (a carne, ou a massa).
   Cada pedido desconta; ao chegar a zero o pastel some do cardápio do cliente até você repor.
4. Pastel de Camarão: crie o ingrediente `Camarão` e use a **mesma massa** na receita — a massa
   é descontada de todos os sabores juntos, e o camarão só dele.

Como o sistema se comporta:
- A baixa acontece **dentro do banco, numa transação só**, quando o cliente confirma o pedido.
  Dois clientes pedindo a última unidade ao mesmo tempo: só um consegue; o outro recebe aviso e a
  sacola é ajustada.
- Na sacola o cliente não consegue passar do que existe (inclusive somando sabores que
  dividem a mesma massa).
- Se o pedido falhar depois da baixa, o estoque é devolvido sozinho.
- Receita **sem ingredientes** não trava a venda (o card mostra "Receita vazia" pra você lembrar).
- Ingrediente usado em alguma receita não pode ser excluído (evita receitas "furadas").
- Nesta versão **não existe cancelamento de pedido**; quando existir, é ele quem devolve o estoque.

## 7. Gerar o APK (sem mudanças em relação a antes)

```bash
npm install
npx cap init "Pastel Sem Fila" "com.pastelsemfila.app" --web-dir=public
npx cap add android
npx cap sync
npx cap open android
```
No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Sempre que mudar algo em `public/`, rode `npx cap sync` de novo e gere um
novo APK. Mudanças de dado (cardápio, descontos, config) não precisam de
APK novo — já são dinâmicas via Supabase.
