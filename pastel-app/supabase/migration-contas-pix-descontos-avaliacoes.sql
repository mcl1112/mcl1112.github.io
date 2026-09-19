-- ============================================================
-- MIGRAÇÃO: contas de cliente, Pix, descontos e avaliações
-- Rode isto no SQL Editor do Supabase DEPOIS do schema.sql original
-- (ou do fix-rls.sql). É seguro rodar mais de uma vez.
-- ============================================================

-- 1) Perfil do cliente (nome/telefone ligados à conta de login)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text
);
alter table profiles enable row level security;
drop policy if exists "profiles: dono le" on profiles;
drop policy if exists "profiles: dono atualiza" on profiles;
drop policy if exists "profiles: dono insere" on profiles;
create policy "profiles: dono le" on profiles for select using (auth.uid() = id);
create policy "profiles: dono atualiza" on profiles for update using (auth.uid() = id);
create policy "profiles: dono insere" on profiles for insert with check (auth.uid() = id);

-- 2) Pedidos: ligar ao cliente logado + status do pagamento Pix
alter table orders add column if not exists user_id uuid references auth.users(id);
alter table orders add column if not exists payment_status text not null default 'pendente';
alter table orders add column if not exists payment_method text not null default 'pix';

-- 3) Configuração: dados da chave Pix da loja
alter table config add column if not exists pix_key text;
alter table config add column if not exists merchant_name text default 'Pastelaria';
alter table config add column if not exists merchant_city text default 'Sao Paulo';

-- 4) Promoções / combos (aba "Descontos" da equipe)
create table if not exists promotions (
  id text primary key,
  type text not null,          -- 'combo' | 'percent' | 'fixed'
  name text not null,
  active boolean default true,
  cat_a text,
  qty_a int,
  cat_b text,
  qty_b int,
  min_subtotal numeric,
  value numeric not null default 0
);
alter table promotions enable row level security;
drop policy if exists "promotions acesso total" on promotions;
create policy "promotions acesso total" on promotions for all using (true) with check (true);

-- 5) Avaliações (aba "Avaliação" da equipe + "Meus Pedidos" do cliente)
create table if not exists reviews (
  id text primary key,
  order_id text references orders(id),
  order_code text,
  user_id uuid,
  customer_name text,
  rating int not null,
  comment text,
  created_at timestamptz not null default now()
);
alter table reviews enable row level security;
drop policy if exists "reviews: leitura publica" on reviews;
drop policy if exists "reviews: cliente insere a propria" on reviews;
create policy "reviews: leitura publica" on reviews for select using (true);
create policy "reviews: cliente insere a propria" on reviews for insert with check (auth.uid() = user_id);

-- 6) Pedidos: agora que existe login, só o próprio cliente pode criar
-- um pedido em seu nome (mas a equipe, sem login próprio, continua
-- enxergando e atualizando TODOS os pedidos — mesmo modelo de acesso
-- que o painel da cozinha já usava).
drop policy if exists "orders acesso total" on orders;
drop policy if exists "orders: insercao publica" on orders;
drop policy if exists "orders: leitura publica" on orders;
drop policy if exists "orders: atualizacao publica" on orders;
create policy "orders: leitura" on orders for select using (true);
create policy "orders: insercao do dono" on orders for insert with check (auth.uid() = user_id);
create policy "orders: atualizacao" on orders for update using (true);

-- ============================================================
-- CONFIGURAÇÃO MANUAL NECESSÁRIA (fora do SQL):
-- Painel do Supabase → Authentication → Settings → desligue
-- "Confirm email". Sem isso, o cliente cria a conta mas não fica
-- logado até confirmar o e-mail, e o primeiro pedido pode falhar.
-- ============================================================
