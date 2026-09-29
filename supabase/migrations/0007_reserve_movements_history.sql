-- A reserva de emergência passa a aceitar vários registros no mesmo mês
-- (histórico completo de quanto entrou/saiu), em vez de só um valor por mês
-- — a constraint antiga fazia um segundo lançamento no mês sobrescrever o
-- primeiro. Rode este arquivo após a 0006.

alter table reserve_movements drop constraint if exists reserve_movements_user_id_month_date_key;
alter table reserve_movements rename column month_date to occurred_at;
alter table reserve_movements alter column occurred_at set default current_date;
