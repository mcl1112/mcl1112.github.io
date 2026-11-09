-- ============================================================
-- PASTEL PERSONALIZADO: configuração inicial sugerida (modelo de PORÇÕES)
--
-- Rode no SQL Editor do Supabase DEPOIS do migration-personalizado.sql e do
-- migration-porcoes.sql.
--
-- O que faz:
--   * cria os tamanhos Pequeno / Médio / Grande (com limite de porções)
--   * cadastra (com estoque ZERO) os ingredientes que ainda não existem
--   * define, para cada ingrediente, o que é 1 PORÇÃO: nome (fatia, colher...),
--     peso (ex.: 1 fatia de mussarela = 25 g) e preço da porção
--   * marca a "Massa de pastel" como a massa dos pastéis personalizados
--
-- É SEGURO: ingrediente com estoque 0 não aparece pro cliente. Pode rodar de novo:
-- só ajusta os ingredientes que ainda estão no modelo antigo (sem "nome da porção"),
-- ou seja, NÃO sobrescreve o que você já configurou depois.
--
-- TODOS OS PESOS E PREÇOS ABAIXO SÃO SUGESTÕES — ajuste em Estoque > Personalizado.
-- ============================================================

-- 1) Tamanhos (preço base | massa gasta | máx. de porções de recheio no total)
insert into custom_sizes (id, name, base_price, factor, dough_qty, max_portions, sort) values
  ('P', 'Pequeno',  5.00, 1, 0.5, 3, 1),
  ('M', 'Médio',    7.00, 1, 1.0, 5, 2),
  ('G', 'Grande',  10.00, 1, 1.5, 8, 3)
on conflict (id) do nothing;

-- tamanhos criados antes do limite de porções existir
update custom_sizes s
   set max_portions = v.mp
  from (values ('P', 3), ('M', 5), ('G', 8)) as v(id, mp)
 where s.id = v.id and s.max_portions = 0;

-- 2) Ingredientes (estoque zero; os que já existem ficam como estão)
insert into ingredients (id, name, unit, stock) values
  ('ing_massa',        'Massa de pastel (disco)', 'un', 0),
  ('ing_carne_moida',  'Carne moída',     'g',  0),
  ('ing_frango',       'Peito de frango', 'g',  0),
  ('ing_carne_seca',   'Carne seca',      'g',  0),
  ('ing_calabresa',    'Calabresa',       'g',  0),
  ('ing_bacon',        'Bacon',           'g',  0),
  ('ing_presunto',     'Presunto',        'g',  0),
  ('ing_camarao',      'Camarão limpo',   'g',  0),
  ('ing_mussarela',    'Mussarela',       'g',  0),
  ('ing_catupiry',     'Catupiry',        'g',  0),
  ('ing_requeijao',    'Requeijão',       'g',  0),
  ('ing_coalho',       'Queijo coalho',   'g',  0),
  ('ing_tomate',       'Tomate',          'g',  0),
  ('ing_cebola',       'Cebola',          'g',  0),
  ('ing_azeitona',     'Azeitona',        'g',  0),
  ('ing_milho',        'Milho',           'g',  0),
  ('ing_palmito',      'Palmito',         'g',  0),
  ('ing_ovo',          'Ovo cozido',      'un', 0),
  ('ing_cheiro_verde', 'Cheiro-verde',    'g',  0),
  ('ing_oregano',      'Orégano',         'g',  0),
  ('ing_banana',       'Banana',          'g',  0),
  ('ing_chocolate',    'Chocolate',       'g',  0),
  ('ing_goiabada',     'Goiabada',        'g',  0),
  ('ing_canela',       'Canela em pó',    'g',  0),
  ('ing_acucar',       'Açúcar',          'g',  0)
on conflict (id) do nothing;

-- 3) O que é 1 PORÇÃO de cada ingrediente
--    colunas: id | categoria | nome da porção | peso de 1 porção (na unidade do ingrediente)
--             | preço de 1 porção (R$) | máx. de porções por pastel
update ingredients i
   set custom_enabled        = true,
       custom_category       = v.cat,
       custom_portion_label  = v.label,
       custom_portion        = v.portion,
       custom_price          = v.price,
       custom_max_qty        = v.maxq
  from (values
    ('ing_carne_moida',  'Carnes',         'porção',  25,   0.75, 4),   -- 1 porção = 25 g  (2 = 50 g)
    ('ing_frango',       'Carnes',         'porção',  30,   0.75, 4),
    ('ing_carne_seca',   'Carnes',         'porção',  20,   1.50, 4),
    ('ing_calabresa',    'Carnes',         'porção',  20,   0.50, 4),
    ('ing_bacon',        'Carnes',         'porção',  10,   0.75, 4),
    ('ing_presunto',     'Carnes',         'fatia',   15,   0.80, 4),
    ('ing_camarao',      'Frutos do mar',  'porção',  20,   2.00, 4),
    ('ing_mussarela',    'Queijos',        'fatia',   25,   1.00, 4),   -- 1 fatia = 25 g  (2 fatias = 50 g)
    ('ing_catupiry',     'Queijos',        'colher',  20,   1.00, 3),
    ('ing_requeijao',    'Queijos',        'colher',  20,   0.80, 3),
    ('ing_coalho',       'Queijos',        'fatia',   30,   1.50, 3),
    ('ing_tomate',       'Vegetais',       'porção',  20,   0.00, 3),
    ('ing_cebola',       'Vegetais',       'porção',  10,   0.00, 3),
    ('ing_azeitona',     'Vegetais',       'porção',   5,   0.25, 4),
    ('ing_milho',        'Vegetais',       'colher',  15,   0.25, 3),
    ('ing_palmito',      'Vegetais',       'porção',  20,   0.75, 3),
    ('ing_ovo',          'Vegetais',       'metade',   0.5, 0.50, 2),   -- 0,5 un = meio ovo
    ('ing_cheiro_verde', 'Temperos',       'pitada',   2,   0.00, 2),
    ('ing_oregano',      'Temperos',       'pitada',   1,   0.00, 2),
    ('ing_banana',       'Doces',          'porção',  40,   0.75, 4),
    ('ing_chocolate',    'Doces',          'porção',  20,   1.00, 4),
    ('ing_goiabada',     'Doces',          'fatia',   25,   0.75, 3),
    ('ing_canela',       'Doces',          'pitada',   1,   0.00, 2),
    ('ing_acucar',       'Doces',          'colher',   5,   0.00, 2)
  ) as v(id, cat, label, portion, price, maxq)
 where i.id = v.id
   and i.custom_portion_label is null;

-- 4) Qual ingrediente é a massa (só se ainda não foi escolhida)
update custom_settings
   set dough_id = 'ing_massa'
 where id = 1
   and dough_id is null
   and exists (select 1 from ingredients where id = 'ing_massa');

-- 5) Conferência: tamanhos e porções disponíveis pro cliente
select id, name as tamanho, base_price as preco_base, max_portions as max_porcoes, dough_qty as massa
  from custom_sizes order by sort;

select custom_category as categoria, name as ingrediente,
       '1 ' || custom_portion_label || ' = ' || custom_portion || ' ' || unit as porcao,
       custom_price as preco_da_porcao, custom_max_qty as max_por_pastel, stock as estoque
  from ingredients
 where custom_enabled
 order by custom_category, name;
