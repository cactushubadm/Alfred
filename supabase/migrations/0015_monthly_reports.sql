-- Relatórios mensais automáticos (Wave 4).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0014.
--
-- Guarda um snapshot gerado sob demanda ao abrir a tela de relatórios (sem
-- job de fundo nem envio por e-mail ainda — isso fica pra quando o serviço
-- de e-mail transacional for configurado). O mês corrente é sempre
-- reprocessado a cada visita (ainda em andamento); meses passados, uma vez
-- gerados, ficam congelados — sobretudo porque `goals.current_amount` e o
-- score de saúde financeira não têm histórico próprio, só o estado no
-- momento em que o relatório foi gerado (mesma limitação documentada em
-- lib/notifications.ts pro "ritmo de contribuição" das metas).

create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_date date not null,
  recebido numeric(12,2) not null,
  gasto numeric(12,2) not null,
  saldo numeric(12,2) not null,
  saldo_anterior numeric(12,2),
  top_category_name text,
  top_category_amount numeric(12,2),
  goals_summary jsonb not null default '[]'::jsonb,
  health_score int,
  created_at timestamptz not null default now(),
  unique (user_id, month_date)
);

alter table monthly_reports enable row level security;

create policy "usuário vê seus relatórios mensais"
  on monthly_reports for select using (auth.uid() = user_id);
create policy "usuário cria seus relatórios mensais"
  on monthly_reports for insert with check (auth.uid() = user_id);
create policy "usuário edita seus relatórios mensais"
  on monthly_reports for update using (auth.uid() = user_id);
create policy "usuário exclui seus relatórios mensais"
  on monthly_reports for delete using (auth.uid() = user_id);
