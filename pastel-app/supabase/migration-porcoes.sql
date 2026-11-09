-- ============================================================
-- MIGRAÇÃO: PORÇÕES NO PASTEL PERSONALIZADO
-- O cliente escolhe QUANTAS PORÇÕES de cada ingrediente (ex.: 1 fatia de
-- queijo = 25 g, 2 fatias = 50 g).
--
-- Rode no SQL Editor do Supabase DEPOIS do migration-personalizado.sql.
-- É seguro rodar mais de uma vez.
--
-- Depois rode o seed-pastel-personalizado.sql (atualizado) para carregar
-- porções realistas (fatia, colher...) nos ingredientes.
-- ============================================================

-- 1) Ingredientes: nome da porção e máximo de porções por pastel
--    (custom_portion agora é o peso/quantidade de UMA porção;
--     custom_price agora é o preço de UMA porção)
alter table ingredients add column if not exists custom_portion_label text;
alter table ingredients add column if not exists custom_max_qty int not null default 4;

-- 2) Tamanhos: máximo de porções de recheio (somando todos os ingredientes). 0 = sem limite.
--    (a coluna "factor" deixou de ser usada; fica no banco sem efeito)
alter table custom_sizes add column if not exists max_portions int not null default 0;

-- 3) Funções de estoque: agora o personalizado chega como
--    p_custom = [{"size":"M","ing":[{"id":"ing_mussarela","n":2},{"id":"ing_carne_moida","n":1}],"qty":1}]
--    ("n" = quantas porções). Baixa = massa do tamanho + n x custom_portion de cada ingrediente.
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
    -- c) personalizado: porções de cada recheio escolhido
    select i.id as ing_id, i.custom_portion * (e.pick ->> 'n')::numeric * c.qty as needed
      from jsonb_to_recordset(coalesce(p_custom, '[]'::jsonb)) as c(size text, ing jsonb, qty numeric)
      join custom_sizes s on s.id = c.size
      cross join lateral jsonb_array_elements(coalesce(c.ing, '[]'::jsonb)) as e(pick)
      join ingredients i on i.id = (e.pick ->> 'id') and i.custom_enabled
  ) n
  group by n.ing_id
$$;

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

  -- cada recheio precisa ser {"id": "...", "n": número > 0} (recusa o formato antigo, só com ids)
  if exists (
    select 1
      from jsonb_to_recordset(coalesce(p_custom, '[]'::jsonb)) as c(size text, ing jsonb, qty numeric)
      cross join lateral jsonb_array_elements(coalesce(c.ing, '[]'::jsonb)) as e(pick)
     where jsonb_typeof(e.pick) <> 'object'
        or (e.pick ->> 'id') is null
        or (e.pick ->> 'n') is null
        or (e.pick ->> 'n')::numeric <= 0
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

-- (restore_stock continua igual: usa stock_needs, que já foi atualizada acima)

grant execute on function stock_needs(jsonb, jsonb) to anon, authenticated;
grant execute on function consume_stock(jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
