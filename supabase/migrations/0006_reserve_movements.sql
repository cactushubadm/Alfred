-- Movimentos mensais da reserva de emergência: em vez de um "aporte mensal"
-- fixo (como no longo prazo), a reserva registra quanto foi guardado ou
-- retirado a cada mês (valor pode ser negativo = retirada).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0005.

create table if not exists reserve_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_date date not null, -- sempre o dia 1 do mês, ex: 2026-09-01
  amount numeric(12,2) not null, -- positivo = guardou, negativo = retirou
  created_at timestamptz not null default now(),
  unique (user_id, month_date)
);

alter table reserve_movements enable row level security;

create policy "usuário vê seus movimentos de reserva"
  on reserve_movements for select using (auth.uid() = user_id);
create policy "usuário cria seus movimentos de reserva"
  on reserve_movements for insert with check (auth.uid() = user_id);
create policy "usuário edita seus movimentos de reserva"
  on reserve_movements for update using (auth.uid() = user_id);
create policy "usuário exclui seus movimentos de reserva"
  on reserve_movements for delete using (auth.uid() = user_id);
