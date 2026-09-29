-- Metas de curto/médio prazo (Wave 2).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0008.

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  target_date date not null,
  current_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table goals enable row level security;

create policy "usuário vê suas metas"
  on goals for select using (auth.uid() = user_id);
create policy "usuário cria suas metas"
  on goals for insert with check (auth.uid() = user_id);
create policy "usuário edita suas metas"
  on goals for update using (auth.uid() = user_id);
create policy "usuário exclui suas metas"
  on goals for delete using (auth.uid() = user_id);
