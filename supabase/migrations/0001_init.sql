-- Migration inicial: contas, categorias e transações
-- Rode este arquivo no SQL Editor do seu projeto Supabase (Project > SQL Editor)

-- CONTAS (carteiras) --------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('corrente', 'poupanca', 'cartao', 'dinheiro')),
  credit_limit numeric(12,2),
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "usuário vê apenas suas contas"
  on accounts for select using (auth.uid() = user_id);
create policy "usuário cria suas contas"
  on accounts for insert with check (auth.uid() = user_id);
create policy "usuário edita suas contas"
  on accounts for update using (auth.uid() = user_id);
create policy "usuário exclui suas contas"
  on accounts for delete using (auth.uid() = user_id);

-- CATEGORIAS ------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = categoria padrão do sistema
  name text not null,
  icon text not null default 'circle',
  type text not null check (type in ('receita', 'despesa')),
  monthly_budget numeric(12,2),
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

create policy "usuário vê categorias padrão e as suas"
  on categories for select using (user_id is null or auth.uid() = user_id);
create policy "usuário cria suas categorias"
  on categories for insert with check (auth.uid() = user_id);
create policy "usuário edita suas categorias"
  on categories for update using (auth.uid() = user_id);
create policy "usuário exclui suas categorias"
  on categories for delete using (auth.uid() = user_id);

-- TRANSAÇÕES (lançamentos) ----------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('receita', 'despesa')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  occurred_at date not null default current_date,
  due_date date,
  is_recurring boolean not null default false,
  status text not null default 'pago' check (status in ('pago', 'pendente', 'atrasado')),
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

create policy "usuário vê apenas seus lançamentos"
  on transactions for select using (auth.uid() = user_id);
create policy "usuário cria seus lançamentos"
  on transactions for insert with check (auth.uid() = user_id);
create policy "usuário edita seus lançamentos"
  on transactions for update using (auth.uid() = user_id);
create policy "usuário exclui seus lançamentos"
  on transactions for delete using (auth.uid() = user_id);

create index if not exists idx_transactions_user_date on transactions(user_id, occurred_at);
