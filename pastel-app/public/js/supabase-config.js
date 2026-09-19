// ============================================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================================
// A URL deve ser SÓ o endereço base do projeto — sem "/rest/v1/"
// no final (esse caminho é adicionado por baixo dos panos pela
// própria biblioteca). Exemplo certo, baseado no seu projeto:
//
//   const SUPABASE_URL = 'https://lkjefvbobbjbprrzippg.supabase.co';
//
// A chave "anon public" vem de Project Settings > API.
// ============================================================

const SUPABASE_URL = 'https://lkjefvbobbjbprrzippg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxramVmdmJvYmJqYnBycnppcHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTIxNjksImV4cCI6MjEwNTA2ODE2OX0.HCZtWCrQunp1cD82_gkGPgXAGy3U_-r5HLgDTXAZkoE';

// Padrão oficial recomendado pelo Supabase: tira "createClient" da
// biblioteca carregada pelo CDN e cria o cliente com um nome PRÓPRIO
// (supabaseClient), evitando qualquer confusão com o objeto global
// "supabase" que o próprio script do CDN expõe em window.supabase.
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
