# Faturas de cartão

1. Aplicar `supabase/migrations/0022_card_invoice_month.sql` antes de publicar o código.
2. Com Node >=22.18 e credenciais administrativas em variáveis de ambiente, gerar o SQL:

```sh
node --experimental-strip-types scripts/backfill-card-invoices.ts > /tmp/card-backfill.sql
```

O script lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Não imprime credenciais,
não executa atualizações e pagina todas as tabelas. Se houver cartão sem fechamento
ou vencimento, aborta sem emitir SQL: configure os dias e gere novamente.

3. Revisar o SQL e obter aprovação do usuário **antes de executá-lo** no SQL Editor.

O SQL usa uma transação única e verifica os valores anteriores para abortar caso
as datas/configuração dos lançamentos tenham mudado desde a geração. Atualiza o
mês de fatura e o vencimento; preserva valores, datas de compra e números de parcela.
A parcela 1 e compras únicas ficam em `transactions.invoice_month/card_due_date`;
as parcelas 2..N ficam em `installments.invoice_month/due_date`.
Não é possível reconstruir dias históricos do cartão se eles já foram alterados:
o backfill usa os dias atualmente cadastrados.
