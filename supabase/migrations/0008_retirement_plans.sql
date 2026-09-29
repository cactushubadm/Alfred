-- Calculadora de aposentadoria/FIRE (Wave 2).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0007.

create table if not exists retirement_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desired_monthly_income numeric(12,2) not null default 0,
  withdrawal_rate numeric(5,4) not null default 0.04, -- taxa de retirada anual, fração (0.04 = 4%)
  inflation_rate numeric(5,2) not null default 4.5, -- % ao ano
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table retirement_plans enable row level security;

create policy "usuário vê seu plano de aposentadoria"
  on retirement_plans for select using (auth.uid() = user_id);
create policy "usuário cria seu plano de aposentadoria"
  on retirement_plans for insert with check (auth.uid() = user_id);
create policy "usuário edita seu plano de aposentadoria"
  on retirement_plans for update using (auth.uid() = user_id);
create policy "usuário exclui seu plano de aposentadoria"
  on retirement_plans for delete using (auth.uid() = user_id);
