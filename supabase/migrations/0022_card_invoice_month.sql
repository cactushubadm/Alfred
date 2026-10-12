-- Primeira parcela (ou compra única) permanece em transactions; 2..N em installments.
-- Não atualiza dados existentes: executar o backfill separadamente após aprovação.
alter table transactions add column invoice_month text
  check (invoice_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
alter table transactions add column card_due_date date;
alter table installments add column invoice_month text
  check (invoice_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
create index idx_transactions_user_invoice on transactions(user_id, invoice_month);
create index idx_transactions_user_card_due on transactions(user_id, card_due_date);
create index idx_installments_user_invoice on installments(user_id, invoice_month);
