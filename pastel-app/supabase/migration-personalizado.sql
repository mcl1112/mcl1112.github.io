-- ============================================================
-- MIGRAÇÃO: PASTEL PERSONALIZADO
-- O cliente escolhe o tamanho (P/M/G) e os recheios; cada escolha
-- baixa do estoque de ingredientes na quantidade certa.
--
-- Rode no SQL Editor do Supabase DEPOIS do migration-estoque.sql.
-- É seguro rodar mais de uma vez.
--
-- ATENÇÃO: este arquivo SUBSTITUI as funções consume_stock/restore_stock
-- do migration-estoque.sql. Se rodar o migration-estoque.sql de novo
-- depois deste, rode este de novo em seguida.
-- ============================================================

-- 1) Ingredientes: como cada um aparece no pastel personalizado
alter table ingredients add column if not exists custom_enabled boolean not null default false;
alter table ingredients add column if not exists custom_category text not null default 'Outros';
alter table ingredients add column if not exists custom_portion numeric not null default 0;  -- quanto vai num pastel MÉDIO (na unidade do ingrediente)
alter table ingredients add column if not exists custom_price numeric not null default 0;    -- adicional (R$) num pastel MÉDIO

-- 2) Tamanhos
create table if not exists custom_sizes (
  id text primary key,                      -- 'P', 'M', 'G'
  name text not null,                       -- Pequeno, Médio, Grande
  base_price numeric not null default 0,    -- preço do pastel sem recheios extras
  factor numeric not null default 1,        -- multiplica a porção e o adicional de cada ingrediente
  dough_qty numeric not null default 1,     -- quanto de massa o tamanho gasta (na unidade da massa)
  sort int not null default 0
);

-- 3) Configuração geral (uma linha só)
create table if not exists custom_settings (
  id int primary key default 1,
  active boolean not null default true,
  dough_id text references ingredients(id) on delete set null   -- qual ingrediente é a massa
);
insert into custom_settings (id) values (1) on conflict (id) do nothing;

-- 4) Permissões (mesmo modelo do resto do app)
alter table custom_sizes enable row level security;
alter table custom_settings enable row level security;
drop policy if exists "custom_sizes acesso total" on custom_sizes;
drop policy if exists "custom_settings acesso total" on custom_settings;
create policy "custom_sizes acesso total" on custom_sizes for all using (true) with check (true);
create policy "custom_settings acesso total" on custom_settings for all using (true) with check (true);

-- ============================================================
-- FUNÇÕES
-- ============================================================

-- Troca as versões antigas (assinatura nova tem o parâmetro p_custom)
drop function if exists consume_stock(jsonb);
drop function if exists restore_stock(jsonb);

-- Quanto de cada ingrediente um pedido precisa, somando:
--   a) itens com receita   p_items  = [{"id":"m1","qty":2}]
--   b) pastéis personalizados p_custom = [{"size":"M","ing":["ing_carne","ing_queijo"],"qty":1}]
create or replace function stock_needs(p_items jsonb, p_custom jsonb)
returns table (ing_id text, needed numeric)
language sql
stable
security definer
set search_path = public
as $$
  select n.ing_id, sum(n.needed)
  from (
    -- a) receitas
    select ri.ingredient_id as ing_id, ri.quantity * x.qty as needed
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id and mi.stock_mode = 'recipe'
      join recipe_items ri on ri.menu_item_id = mi.id
    union all
    -- b) personalizado: a massa do tamanho escolhido
    select cs.dough_id as ing_id, s.dough_qty * c.qty as needed
      from jsonb_to_recordset(coalesce(p_custom, '[]'::jsonb)) as c(size text, ing jsonb, qty numeric)
      join custom_sizes s on s.id = c.size
      cross join custom_settings cs
     where cs.id = 1 and cs.dough_id is not null
    union all
    -- c) personalizado: cada recheio escolhido (porção do médio x fator do tamanho)
    select i.id as ing_id, i.custom_portion * s.factor * c.qty as needed
      from jsonb_to_recordset(coalesce(p_custom, '[]'::jsonb)) as c(size text, ing jsonb, qty numeric)
      join custom_sizes s on s.id = c.size
      cross join lateral jsonb_array_elements_text(c.ing) as e(ing_id)
      join ingredients i on i.id = e.ing_id and i.custom_enabled
  ) n
  group by n.ing_id
$$;

-- Dá baixa no estoque de um pedido. Se faltar qualquer coisa, NÃO baixa nada
-- e devolve o erro ESTOQUE_INSUFICIENTE.
create or replace function consume_stock(p_items jsonb, p_custom jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, qty numeric)
    where x.qty is null or x.qty <= 0
  ) then
    raise exception 'QUANTIDADE_INVALIDA';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_custom, '[]'::jsonb)) as c(size text, ing jsonb, qty numeric)
    where c.qty is null or c.qty <= 0
       or not exists (select 1 from custom_sizes s where s.id = c.size)
  ) then
    raise exception 'PASTEL_PERSONALIZADO_INVALIDO';
  end if;

  -- trava as linhas envolvidas (ordem fixa, evita deadlock entre pedidos simultâneos)
  perform 1 from ingredients
   where id in (select n.ing_id from stock_needs(p_items, p_custom) n)
   order by id
   for update;

  perform 1 from menu_items
   where id in (select x.id from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, qty numeric))
     and stock_mode = 'direct'
   order by id
   for update;

  -- 1) produtos de estoque direto (bebidas, pastéis prontos)
  for r in
    select mi.id, mi.name, mi.stock_qty, sum(x.qty) as qty
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id
     where mi.stock_mode = 'direct'
     group by mi.id, mi.name, mi.stock_qty
  loop
    if r.stock_qty < r.qty then
      raise exception 'ESTOQUE_INSUFICIENTE: %', r.name;
    end if;
    update menu_items set stock_qty = stock_qty - r.qty where id = r.id;
  end loop;

  -- 2) ingredientes (receitas + pastéis personalizados, tudo somado)
  for r in
    select i.id, i.name, i.stock, n.needed
      from stock_needs(p_items, p_custom) n
      join ingredients i on i.id = n.ing_id
  loop
    if r.stock < r.needed then
      raise exception 'ESTOQUE_INSUFICIENTE: %', r.name;
    end if;
    update ingredients set stock = stock - r.needed where id = r.id;
  end loop;
end;
$$;

-- Devolve ao estoque (usada se o pedido falhar depois da baixa)
create or replace function restore_stock(p_items jsonb, p_custom jsonb default '[]'::jsonb)
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
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, qty numeric)
      join menu_items mi on mi.id = x.id
     where mi.stock_mode = 'direct' and x.qty > 0
     group by mi.id
  loop
    update menu_items set stock_qty = stock_qty + r.qty where id = r.id;
  end loop;

  for r in
    select n.ing_id as id, n.needed as qty
      from stock_needs(p_items, p_custom) n
     where n.needed > 0
  loop
    update ingredients set stock = stock + r.qty where id = r.id;
  end loop;
end;
$$;

grant execute on function stock_needs(jsonb, jsonb) to anon, authenticated;
grant execute on function consume_stock(jsonb, jsonb) to anon, authenticated;
grant execute on function restore_stock(jsonb, jsonb) to anon, authenticated;

-- faz a API enxergar as funções novas na hora
notify pgrst, 'reload schema';
