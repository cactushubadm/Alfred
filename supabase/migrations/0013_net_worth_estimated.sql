-- Marca snapshots de patrimônio líquido preenchidos automaticamente por
-- carry-forward, pros meses em que o usuário não abriu a tela e por isso
-- não temos como calcular o valor real (Wave 3).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, após a 0012.

alter table net_worth_snapshots add column if not exists estimated boolean not null default false;
