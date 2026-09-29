-- Perfis de investimento (Wave 2): aporte mensal, taxa de retorno esperada
-- e saldo atual, separados por tipo (reserva de emergência vs. longo prazo).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0004.

create table if not exists investment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('reserva', 'longo_prazo')),
  monthly_contribution numeric(12,2) not null default 0,
  expected_annual_rate numeric(5,2) not null default 0, -- % ao ano, ex: 8.50 = 8,5% a.a.
  current_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, type)
);

alter table investment_profiles enable row level security;

create policy "usuário vê seus perfis de investimento"
  on investment_profiles for select using (auth.uid() = user_id);
create policy "usuário cria seus perfis de investimento"
  on investment_profiles for insert with check (auth.uid() = user_id);
create policy "usuário edita seus perfis de investimento"
  on investment_profiles for update using (auth.uid() = user_id);
create policy "usuário exclui seus perfis de investimento"
  on investment_profiles for delete using (auth.uid() = user_id);
