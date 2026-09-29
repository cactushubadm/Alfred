-- Dívidas + simulador de quitação (avalanche vs bola de neve) (Wave 3).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0010.

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cartao', 'emprestimo', 'financiamento', 'cheque_especial')),
  balance numeric(12,2) not null,
  monthly_interest_rate numeric(5,2) not null, -- % ao mês (8.50 = 8,5% a.m.)
  monthly_payment numeric(12,2) not null,
  remaining_installments int,
  created_at timestamptz not null default now()
);

alter table debts enable row level security;

create policy "usuário vê suas dívidas"
  on debts for select using (auth.uid() = user_id);
create policy "usuário cria suas dívidas"
  on debts for insert with check (auth.uid() = user_id);
create policy "usuário edita suas dívidas"
  on debts for update using (auth.uid() = user_id);
create policy "usuário exclui suas dívidas"
  on debts for delete using (auth.uid() = user_id);
