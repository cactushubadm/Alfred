-- Módulo de estimativa de compra (Wave 4, Seção 2.8 do PRD).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0013.

create table if not exists purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cash_price numeric(12,2) not null,
  installment_count int not null,
  has_interest boolean not null default false,
  interest_rate numeric(6,3), -- % ao mês do parcelamento, só quando has_interest = true
  created_at timestamptz not null default now()
);

alter table purchase_intents enable row level security;

create policy "usuário vê suas intenções de compra"
  on purchase_intents for select using (auth.uid() = user_id);
create policy "usuário cria suas intenções de compra"
  on purchase_intents for insert with check (auth.uid() = user_id);
create policy "usuário edita suas intenções de compra"
  on purchase_intents for update using (auth.uid() = user_id);
create policy "usuário exclui suas intenções de compra"
  on purchase_intents for delete using (auth.uid() = user_id);
