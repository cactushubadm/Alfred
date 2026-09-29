-- Snapshots mensais de patrimônio líquido (Wave 3).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0011.
--
-- Gerado sob demanda ao abrir a tela de patrimônio líquido — mesmo espírito
-- da geração on-demand dos lançamentos recorrentes (ver `lib/recurring.ts`):
-- não há job de fundo, então um mês em que o usuário nunca abriu a tela
-- fica sem snapshot no histórico.

create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_date date not null,
  assets numeric(14,2) not null,
  liabilities numeric(14,2) not null,
  net_worth numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, month_date)
);

alter table net_worth_snapshots enable row level security;

create policy "usuário vê seus snapshots de patrimônio"
  on net_worth_snapshots for select using (auth.uid() = user_id);
create policy "usuário cria seus snapshots de patrimônio"
  on net_worth_snapshots for insert with check (auth.uid() = user_id);
create policy "usuário edita seus snapshots de patrimônio"
  on net_worth_snapshots for update using (auth.uid() = user_id);
create policy "usuário exclui seus snapshots de patrimônio"
  on net_worth_snapshots for delete using (auth.uid() = user_id);
