-- Rode isto depois da migração anterior (é só uma coluna nova).
alter table config add column if not exists pix_key_type text default 'cpf_cnpj';
