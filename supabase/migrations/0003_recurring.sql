-- Geração automática de lançamentos recorrentes
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0002.
-- Cada lançamento gerado automaticamente a partir de um recorrente guarda o
-- id de origem, para sabermos até onde a cadeia já foi propagada e nunca
-- gerar duplicado no mesmo mês.

alter table transactions
  add column if not exists recurring_source_id uuid references transactions(id) on delete set null;

create index if not exists idx_transactions_recurring_source on transactions(recurring_source_id);
create index if not exists idx_transactions_recurring_pending
  on transactions(user_id, occurred_at) where is_recurring = true;
