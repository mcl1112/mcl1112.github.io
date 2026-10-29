-- >>> ATENÇÃO: com o pastel personalizado, os pastéis PRONTOS devem usar "Estoque direto"
-- >>> (igual à Coca), configurado em Estoque > Produtos. NÃO rode este arquivo para eles:
-- >>> ele colocaria os pastéis em modo "Por receita". Só use se quiser mesmo esse modo.
-- ============================================================
-- ATIVAR O CONTROLE DE ESTOQUE POR RECEITA
--
-- Rode SÓ DEPOIS de colocar as quantidades reais na aba
-- Estoque > Ingredientes. Se algum ingrediente estiver com 0, os
-- pastéis que dependem dele somem do cardápio do cliente na hora
-- (é o comportamento esperado do estoque).
--
-- Liga o modo "Por receita" em todo produto que já tem receita
-- cadastrada e ainda está como "Não controlar".
-- ============================================================
update menu_items
   set stock_mode = 'recipe',
       stock_qty = 0
 where stock_mode = 'none'
   and id in (select distinct menu_item_id from recipe_items);

-- Conferência: como ficou cada produto e quantos dá pra fazer agora
select mi.name as produto,
       mi.stock_mode as modo,
       min(floor(i.stock / ri.quantity)) as da_pra_fazer
from menu_items mi
left join recipe_items ri on ri.menu_item_id = mi.id
left join ingredients i on i.id = ri.ingredient_id
where mi.stock_mode = 'recipe'
group by mi.name, mi.stock_mode
order by mi.name;
