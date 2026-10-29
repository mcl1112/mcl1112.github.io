-- >>> OPCIONAL: as receitas por pastel só servem se você quiser o modo "Por receita".
-- >>> Para pastéis prontos use "Estoque direto" e, para o catálogo de ingredientes do pastel
-- >>> personalizado, use o seed-pastel-personalizado.sql (ele já cria esses mesmos ingredientes).
-- ============================================================
-- RECEITAS SUGERIDAS: carne, queijo, frango c/ catupiry, camarão,
-- carne seca c/ queijo e pizza.
--
-- Rode UMA vez no SQL Editor do Supabase (depois do migration-estoque.sql).
--
-- É SEGURO: cadastra os ingredientes com estoque ZERO e NÃO liga o controle
-- de estoque nos pastéis (continua "Não controlar"), então o cardápio dos
-- clientes não muda nada agora. Depois:
--   1) coloque as quantidades REAIS na aba Estoque > Ingredientes
--   2) rode o arquivo ativar-estoque-por-receita.sql (ou ligue produto a
--      produto na aba Estoque > Produtos > Configurar > "Por receita")
--
-- Rodar de novo NÃO apaga o estoque que você já digitou (só reaplica as
-- quantidades das receitas).
--
-- AS QUANTIDADES SÃO ESTIMATIVAS pra um pastel de feira de tamanho médio
-- (cerca de 60 a 95 g de recheio) — ajuste na aba Estoque conforme a sua
-- receita e o seu custo. Pesos de carne/frango/camarão são de COMPRA (crus).
-- ============================================================

-- 1) Ingredientes (estoque zero)
insert into ingredients (id, name, unit, stock) values
  ('ing_massa',       'Massa de pastel (disco)', 'un', 0),
  ('ing_carne_moida', 'Carne moída',             'g',  0),
  ('ing_frango',      'Peito de frango',         'g',  0),
  ('ing_catupiry',    'Catupiry',                'g',  0),
  ('ing_camarao',     'Camarão limpo',           'g',  0),
  ('ing_carne_seca',  'Carne seca',              'g',  0),
  ('ing_mussarela',   'Mussarela',               'g',  0),
  ('ing_presunto',    'Presunto',                'g',  0),
  ('ing_tomate',      'Tomate',                  'g',  0),
  ('ing_cebola',      'Cebola',                  'g',  0),
  ('ing_azeitona',    'Azeitona',                'g',  0)
on conflict (id) do nothing;

-- 2) Acha cada pastel no seu cardápio pelo nome (e cria, desativado, os que faltarem)
--    e grava as receitas.
do $$
declare
  v_carne      text;
  v_queijo     text;
  v_frango     text;
  v_camarao    text;
  v_carneseca  text;
  v_pizza      text;
begin
  select id into v_carneseca from menu_items
    where name ilike '%carne seca%' or name ilike '%carne de sol%'
    order by id limit 1;

  select id into v_camarao from menu_items
    where name ilike '%camar%'
    order by id limit 1;

  select id into v_frango from menu_items
    where name ilike '%frango%'
    order by id limit 1;

  select id into v_pizza from menu_items
    where name ilike '%pizza%'
    order by id limit 1;

  select id into v_queijo from menu_items
    where name ilike '%queijo%'
      and name not ilike '%carne%' and name not ilike '%frango%'
      and name not ilike '%camar%' and name not ilike '%pizza%'
    order by id limit 1;

  select id into v_carne from menu_items
    where name ilike '%carne%'
      and name not ilike '%seca%' and name not ilike '%sol%'
      and name not ilike '%queijo%'
    order by id limit 1;

  -- Os que não existirem no cardápio são criados DESATIVADOS e com preço 0:
  -- vá em Cardápio, defina o preço e ative quando quiser vender.
  if v_camarao is null then
    v_camarao := 'm_camarao';
    insert into menu_items (id, cat, name, description, price, emoji, active)
    values (v_camarao, 'Salgados', 'Pastel de Camarão',
            'Camarão refogado com tomate e cheiro-verde.', 0, '🍤', false)
    on conflict (id) do nothing;
  end if;

  if v_carneseca is null then
    v_carneseca := 'm_carne_seca_queijo';
    insert into menu_items (id, cat, name, description, price, emoji, active)
    values (v_carneseca, 'Salgados', 'Pastel de Carne Seca com Queijo',
            'Carne seca desfiada com queijo derretido.', 0, '🥩', false)
    on conflict (id) do nothing;
  end if;

  -- Receitas: quanto de cada ingrediente vai em 1 pastel
  insert into recipe_items (menu_item_id, ingredient_id, quantity)
  select r.item_id, r.ing_id, max(r.qty)
  from (values
    -- Carne
    (v_carne,     'ing_massa',       1),
    (v_carne,     'ing_carne_moida', 50),
    (v_carne,     'ing_cebola',      10),
    (v_carne,     'ing_azeitona',    6),
    -- Queijo
    (v_queijo,    'ing_massa',       1),
    (v_queijo,    'ing_mussarela',   70),
    -- Frango com catupiry
    (v_frango,    'ing_massa',       1),
    (v_frango,    'ing_frango',      70),
    (v_frango,    'ing_catupiry',    30),
    (v_frango,    'ing_cebola',      8),
    -- Camarão
    (v_camarao,   'ing_massa',       1),
    (v_camarao,   'ing_camarao',     40),
    (v_camarao,   'ing_cebola',      8),
    (v_camarao,   'ing_tomate',      15),
    -- Carne seca com queijo
    (v_carneseca, 'ing_massa',       1),
    (v_carneseca, 'ing_carne_seca',  45),
    (v_carneseca, 'ing_mussarela',   35),
    (v_carneseca, 'ing_cebola',      10),
    -- Pizza
    (v_pizza,     'ing_massa',       1),
    (v_pizza,     'ing_mussarela',   45),
    (v_pizza,     'ing_presunto',    30),
    (v_pizza,     'ing_tomate',      20)
  ) as r(item_id, ing_id, qty)
  where r.item_id is not null
  group by r.item_id, r.ing_id
  on conflict (menu_item_id, ingredient_id)
  do update set quantity = excluded.quantity;
end $$;

-- 3) Conferência: mostra cada pastel com a receita que ficou cadastrada
select mi.name   as produto,
       i.name    as ingrediente,
       ri.quantity as qtd_por_pastel,
       i.unit    as unidade,
       mi.active as ativo_no_cardapio
from recipe_items ri
join menu_items mi on mi.id = ri.menu_item_id
join ingredients i on i.id = ri.ingredient_id
order by mi.name, i.name;
