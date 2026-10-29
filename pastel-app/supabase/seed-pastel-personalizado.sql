-- ============================================================
-- PASTEL PERSONALIZADO: configuração inicial sugerida
--
-- Rode UMA vez no SQL Editor do Supabase, depois do migration-personalizado.sql.
--
-- O que faz:
--   * cria os tamanhos Pequeno / Médio / Grande
--   * cadastra (com estoque ZERO) os ingredientes que ainda não existem
--   * deixa todos disponíveis para o cliente montar o pastel, com porção e
--     adicional de preço sugeridos
--   * marca a "Massa de pastel" como a massa dos pastéis personalizados
--
-- É SEGURO: o pastel personalizado só aparece pro cliente quando houver estoque
-- (ingrediente com 0 fica indisponível sozinho), e rodar de novo NÃO sobrescreve
-- o que você já ajustou.
--
-- TODOS OS PREÇOS E PORÇÕES ABAIXO SÃO SUGESTÕES: ajuste em
-- Estoque > Personalizado. Porções valem para o tamanho MÉDIO; o Pequeno e o
-- Grande usam o "fator" do tamanho (0,6x e 1,5x).
-- ============================================================

-- 1) Tamanhos
insert into custom_sizes (id, name, base_price, factor, dough_qty, sort) values
  ('P', 'Pequeno',  5.00, 0.6, 0.5, 1),
  ('M', 'Médio',    7.00, 1.0, 1.0, 2),
  ('G', 'Grande',  10.00, 1.5, 1.5, 3)
on conflict (id) do nothing;

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

-- 3) Como cada ingrediente aparece pro cliente (só mexe nos que ainda não foram configurados)
update ingredients i
   set custom_enabled  = true,
       custom_category = v.cat,
       custom_portion  = v.portion,
       custom_price    = v.price
  from (values
    -- id,                categoria,        porção (médio), adicional R$ (médio)
    ('ing_carne_moida',  'Carnes',          50,   1.50),
    ('ing_frango',       'Carnes',          60,   1.50),
    ('ing_carne_seca',   'Carnes',          40,   3.00),
    ('ing_calabresa',    'Carnes',          40,   1.00),
    ('ing_bacon',        'Carnes',          25,   1.50),
    ('ing_presunto',     'Carnes',          30,   1.00),
    ('ing_camarao',      'Frutos do mar',   40,   4.00),
    ('ing_mussarela',    'Queijos',         50,   1.50),
    ('ing_catupiry',     'Queijos',         30,   1.50),
    ('ing_requeijao',    'Queijos',         30,   1.00),
    ('ing_coalho',       'Queijos',         40,   2.00),
    ('ing_tomate',       'Vegetais',        20,   0.00),
    ('ing_cebola',       'Vegetais',        10,   0.00),
    ('ing_azeitona',     'Vegetais',         8,   0.50),
    ('ing_milho',        'Vegetais',        20,   0.50),
    ('ing_palmito',      'Vegetais',        30,   1.50),
    ('ing_ovo',          'Vegetais',         0.5, 1.00),
    ('ing_cheiro_verde', 'Temperos',         3,   0.00),
    ('ing_oregano',      'Temperos',         1,   0.00),
    ('ing_banana',       'Doces',           50,   1.00),
    ('ing_chocolate',    'Doces',           40,   2.00),
    ('ing_goiabada',     'Doces',           40,   1.50),
    ('ing_canela',       'Doces',            1,   0.00),
    ('ing_acucar',       'Doces',            5,   0.00)
  ) as v(id, cat, portion, price)
 where i.id = v.id
   and i.custom_enabled = false
   and i.custom_portion = 0;

-- 4) Qual ingrediente é a massa (só se ainda não foi escolhida)
update custom_settings
   set dough_id = 'ing_massa'
 where id = 1
   and dough_id is null
   and exists (select 1 from ingredients where id = 'ing_massa');

-- 5) Conferência: tamanhos e ingredientes disponíveis pro cliente
select id, name as tamanho, base_price as preco_base, factor as fator, dough_qty as massa
  from custom_sizes order by sort;

select custom_category as categoria, name as ingrediente, unit as unidade,
       custom_portion as porcao_medio, custom_price as adicional_medio, stock as estoque
  from ingredients
 where custom_enabled
 order by custom_category, name;
