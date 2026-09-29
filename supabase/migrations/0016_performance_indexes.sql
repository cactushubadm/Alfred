-- Índices de performance (auditoria de lentidão percebida ao navegar).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0015.

-- Contas a pagar/receber, notificações e fluxo de caixa projetado filtram
-- (status, due_date) toda hora — não havia índice nenhum cobrindo isso
-- além da chave primária.
create index if not exists idx_transactions_status_due
  on transactions(user_id, status, due_date)
  where due_date is not null;

-- Ficou sem índice desde a 0007: ela trocou `month_date` por `occurred_at`
-- e derrubou o `unique(user_id, month_date)` que servia de índice
-- implícito, sem criar um substituto. A tela de reserva de emergência e o
-- patrimônio líquido filtram por (user_id, occurred_at) o tempo todo.
create index if not exists idx_reserve_movements_user_date
  on reserve_movements(user_id, occurred_at);
