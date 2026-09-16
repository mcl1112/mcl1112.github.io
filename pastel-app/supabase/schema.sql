-- ============================================================
-- FIX DE RLS — cole isto inteiro no SQL Editor do Supabase e rode.
-- Resolve o erro clássico "new row violates row-level security
-- policy" (ou "permission denied") ao inserir/atualizar/excluir
-- em config, menu_items ou orders.
--
-- O que ele faz: apaga as políticas antigas (se existirem) e cria
-- UMA política "for all" por tabela, liberando select/insert/
-- update/delete pra quem usa a chave anon — igual ao nível de
-- proteção que o site já tinha (a senha "1234" é só trava de tela).
-- ============================================================

-- garante que as tabelas existem (não faz nada se já existirem)
create table if not exists config (
  id int primary key default 1,
  slot_interval int not null default 15,
  max_per_slot int not null default 5,
  min_lead int not null default 20,
  open_hour int not null default 11,
  open_minute int not null default 0,
  close_hour int not null default 21,
  close_minute int not null default 0,
  max_days_ahead int not null default 2
);
insert into config (id) values (1) on conflict (id) do nothing;

create table if not exists menu_items (
  id text primary key,
  cat text not null,
  name text not null,
  description text,
  price numeric not null default 0,
  emoji text,
  image text,
  badge text,
  highlight boolean default false,
  active boolean default true
);

create table if not exists orders (
  id text primary key,
  code text not null,
  customer_name text not null,
  phone text not null,
  items jsonb not null,
  subtotal numeric not null,
  discount numeric not null default 0,
  total numeric not null,
  slot_key text not null,
  pickup_label text not null,
  pickup_day_label text not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

-- remove qualquer política antiga (nomes do schema.sql original)
drop policy if exists "config: leitura publica" on config;
drop policy if exists "config: escrita publica" on config;
drop policy if exists "menu: leitura publica" on menu_items;
drop policy if exists "menu: insercao publica" on menu_items;
drop policy if exists "menu: atualizacao publica" on menu_items;
drop policy if exists "menu: exclusao publica" on menu_items;
drop policy if exists "orders: leitura publica" on orders;
drop policy if exists "orders: insercao publica" on orders;
drop policy if exists "orders: atualizacao publica" on orders;
drop policy if exists "config acesso total" on config;
drop policy if exists "menu acesso total" on menu_items;
drop policy if exists "orders acesso total" on orders;

-- garante que o RLS está ligado
alter table config enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;

-- uma política só por tabela, cobrindo select/insert/update/delete
create policy "config acesso total" on config
  for all using (true) with check (true);

create policy "menu acesso total" on menu_items
  for all using (true) with check (true);

create policy "orders acesso total" on orders
  for all using (true) with check (true);
