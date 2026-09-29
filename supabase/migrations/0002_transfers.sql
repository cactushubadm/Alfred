-- Suporte a transferências entre contas
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0001.
-- Transferências são lançamentos com type = 'transferencia': account_id é a
-- conta de origem e transfer_account_id a conta de destino. Não contam como
-- receita nem despesa nos totais (o front filtra por type).

alter table transactions drop constraint transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('receita', 'despesa', 'transferencia'));

alter table transactions
  add column if not exists transfer_account_id uuid references accounts(id) on delete set null;
