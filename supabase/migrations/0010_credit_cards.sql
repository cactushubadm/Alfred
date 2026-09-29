-- Cartão de crédito como entidade própria + parcelamentos (Wave 3).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0009.

-- Estende accounts (type = 'cartao') com os dados de fatura do cartão.
-- credit_limit já existia; adicionamos dia de fechamento e de vencimento.
alter table accounts add column if not exists closing_day int check (closing_day between 1 and 31);
alter table accounts add column if not exists due_day int check (due_day between 1 and 31);

-- PARCELAMENTOS ----------------------------------------------------------
-- A parcela 1 é a própria transação lançada (já entra nos totais do mês).
-- As parcelas futuras (2..N) ficam aqui, geradas automaticamente ao lançar
-- uma despesa parcelada.
create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  installment_number int not null,
  total_installments int not null,
  amount numeric(12,2) not null,
  due_date date not null,
  created_at timestamptz not null default now()
);

alter table installments enable row level security;

create policy "usuário vê suas parcelas"
  on installments for select using (auth.uid() = user_id);
create policy "usuário cria suas parcelas"
  on installments for insert with check (auth.uid() = user_id);
create policy "usuário edita suas parcelas"
  on installments for update using (auth.uid() = user_id);
create policy "usuário exclui suas parcelas"
  on installments for delete using (auth.uid() = user_id);

create index if not exists idx_installments_transaction on installments(transaction_id);
create index if not exists idx_installments_user_due on installments(user_id, due_date);
