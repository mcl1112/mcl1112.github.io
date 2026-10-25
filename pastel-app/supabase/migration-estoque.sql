-- ============================================================
-- MIGRAÇÃO: ESTOQUE (ingredientes, receitas e revenda)
-- Rode no SQL Editor do Supabase depois das migrações anteriores.
-- É seguro rodar mais de uma vez.
-- ============================================================

-- 1) Ingredientes (massa, carne, queijo, camarão, ...)
create table if not exists ingredients (
  id text primary key,
  name text not null,
  unit text not null default 'g',          -- g, kg, ml, L ou un
  stock numeric not null default 0 check (stock >= 0)
);

-- 2) Receitas: quanto de cada ingrediente vai em 1 unidade do produto
create table if not exists recipe_items (
  menu_item_id text not null references menu_items(id) on delete cascade,
  ingredient_id text not null references ingredients(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  primary key (menu_item_id, ingredient_id)
);

-- 3) Como cada produto do cardápio controla estoque
--    none   = não controla (sempre disponível)  <- padrão, nada muda até você configurar
--    recipe = baixa ingredientes pela receita   (pastéis)
--    direct = baixa unidades do próprio produto (bebidas de revenda)
alter table menu_items add column if not exists stock_mode text not null default 'none';
alter table menu_items add column if not exists stock_qty numeric not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_stock_mode_check') then
    alter table menu_items add constraint menu_items_stock_mode_check
      check (stock_mode in ('none', 'recipe', 'direct'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menu_items_stock_qty_check') then
    alter table menu_items add constraint menu_items_stock_qty_check
      check (stock_qty >= 0);
  end if;
end $$;

-- 4) Permissões (mesmo modelo do resto do app: a equipe usa a chave anon)
alter table ingredients enable row level security;
alter table recipe_items enable row level security;
drop policy if exists "ingredients acesso total" on ingredients;
drop policy if exists "recipe_items acesso total" on recipe_items;
create policy "ingredients acesso total" on ingredients for all using (true) with check (true);
create policy "recipe_items acesso total" on recipe_items for all using (true) with check (true);

-- ============================================================
-- FUNÇÕES (a baixa do estoque acontece AQUI, dentro do banco, numa
-- transação só — assim dois clientes pedindo ao mesmo tempo nunca
-- vendem a mesma última unidade duas vezes)
-- ============================================================

-- Dá baixa no estoque de um pedido. p_items = [{"id":"m1","qty":2}, ...]
-- Se faltar qualquer coisa, NÃO baixa nada e devolve o erro ESTOQUE_INSUFICIENTE.
create or replace function consume_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(id text, qty numeric)
    where x.qty is null or x.qty <= 0
  ) then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  -- trava as linhas envolvidas (ordem fixa, pra evitar deadlock entre pedidos simultâneos)
  perform 1 from ingredients
   where id in (
     select ri.ingredient_id
       from jsonb_to_recordset(p_items) as x(id text, qty numeric)
       join menu_items mi on mi.id = x.id and mi.stock_mode = 'recipe'
       join recipe_items ri on ri.menu_item_id = mi.id
   )
   order by id
   for update;

  perform 1 from menu_items
   where id in (select x.id from jsonb_to_recordset(p_items) as x(id text, qty numeric))
     and stock_mode = 'direct'
   order by id
   for update;

  -- 1) produtos de revenda (bebidas): baixa direto no produto
  for r in
    select mi.id, mi.name, mi.stock_qty, sum(x.qty) as qty
      from jsonb_to_recordset(p_items) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id
     where mi.stock_mode = 'direct'
     group by mi.id, mi.name, mi.stock_qty
  loop
    if r.stock_qty < r.qty then
      raise exception 'ESTOQUE_INSUFICIENTE: %', r.name;
    end if;
    update menu_items set stock_qty = stock_qty - r.qty where id = r.id;
  end loop;

  -- 2) produtos de receita (pastéis): soma o que cada ingrediente precisa no pedido inteiro
  for r in
    select i.id, i.name, i.stock, sum(ri.quantity * x.qty) as needed
      from jsonb_to_recordset(p_items) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id and mi.stock_mode = 'recipe'
      join recipe_items ri on ri.menu_item_id = mi.id
      join ingredients i on i.id = ri.ingredient_id
     group by i.id, i.name, i.stock
  loop
    if r.stock < r.needed then
      raise exception 'ESTOQUE_INSUFICIENTE: %', r.name;
    end if;
    update ingredients set stock = stock - r.needed where id = r.id;
  end loop;
end;
$$;

-- Devolve ao estoque (usada se o pedido falhar depois da baixa)
create or replace function restore_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select mi.id, sum(x.qty) as qty
      from jsonb_to_recordset(p_items) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id
     where mi.stock_mode = 'direct' and x.qty > 0
     group by mi.id
  loop
    update menu_items set stock_qty = stock_qty + r.qty where id = r.id;
  end loop;

  for r in
    select ri.ingredient_id as id, sum(ri.quantity * x.qty) as qty
      from jsonb_to_recordset(p_items) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id and mi.stock_mode = 'recipe'
      join recipe_items ri on ri.menu_item_id = mi.id
     where x.qty > 0
     group by ri.ingredient_id
  loop
    update ingredients set stock = stock + r.qty where id = r.id;
  end loop;
end;
$$;

-- Repor/ajustar estoque de forma segura (soma ou subtrai, em vez de sobrescrever)
create or replace function adjust_stock(p_kind text, p_id text, p_delta numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'ingredient' then
    update ingredients set stock = greatest(stock + p_delta, 0) where id = p_id;
  elsif p_kind = 'item' then
    update menu_items set stock_qty = greatest(stock_qty + p_delta, 0) where id = p_id;
  else
    raise exception 'TIPO_INVALIDO';
  end if;
end;
$$;

grant execute on function consume_stock(jsonb) to anon, authenticated;
grant execute on function restore_stock(jsonb) to anon, authenticated;
grant execute on function adjust_stock(text, text, numeric) to anon, authenticated;

-- faz a API enxergar as funções novas na hora
notify pgrst, 'reload schema';
