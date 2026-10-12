/** Gera SQL revisável; NÃO executa updates. Node >=22.18.
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node --experimental-strip-types scripts/backfill-card-invoices.ts > /tmp/card-backfill.sql
 * Após aprovação, executar o SQL gerado no SQL Editor (transação única).
 */
import { createClient } from '@supabase/supabase-js';
import { cardSchedule } from '../lib/cartao.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Informe SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
const db = createClient(url, key, { auth: { persistSession: false } });
async function readAll(table: string, columns: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select(columns).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data!);
    if (data!.length < 500) return rows;
  }
}
const [accounts, transactions, installments] = await Promise.all([
  readAll('accounts', 'id, user_id, type, closing_day, due_day'),
  readAll('transactions', 'id, user_id, account_id, type, occurred_at, invoice_month, card_due_date'),
  readAll('installments', 'id, user_id, transaction_id, installment_number, total_installments, invoice_month, due_date'),
]);
const quote = (v: string | null) => v == null ? 'NULL' : `'${v.replaceAll("'", "''")}'`;
const sql: string[] = ['BEGIN;', 'LOCK TABLE accounts, transactions, installments IN SHARE ROW EXCLUSIVE MODE;'];
let changed = 0;
for (const tx of transactions) {
  const card = accounts.find(a => a.id === tx.account_id && a.type === 'cartao');
  if (!card || tx.type !== 'despesa') continue;
  if (card.user_id !== tx.user_id) throw new Error(`Titular divergente: ${tx.id}`);
  sql.push(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = ${quote(card.id)} AND type = 'cartao' AND closing_day = ${card.closing_day ?? 'NULL'} AND due_day = ${card.due_day ?? 'NULL'}) THEN RAISE EXCEPTION 'Configuração do cartão alterada: ${card.id}'; END IF; END $$;`);
  const rows = installments.filter(i => i.transaction_id === tx.id);
  const count = Math.max(1, ...rows.map(i => i.total_installments), ...rows.map(i => i.installment_number));
  // Falha antes de emitir SQL se um cartão não tiver configuração suficiente.
  const schedule = cardSchedule(tx.occurred_at, card.closing_day, card.due_day, count);
  const update = (table: string, id: string, assignment: string, guard: string) => {
    sql.push(`DO $$ BEGIN UPDATE ${table} SET ${assignment} WHERE id = ${quote(id)} AND ${guard}; IF NOT FOUND THEN RAISE EXCEPTION 'Dados alterados desde a geração do backfill: ${id}'; END IF; END $$;`);
    changed++;
  };
  update('transactions', tx.id, `invoice_month = ${quote(schedule[0].invoice_month)}, card_due_date = ${quote(schedule[0].due_date)}`,
    `occurred_at = ${quote(tx.occurred_at)} AND account_id = ${quote(tx.account_id)} AND invoice_month IS NOT DISTINCT FROM ${quote(tx.invoice_month)} AND card_due_date IS NOT DISTINCT FROM ${quote(tx.card_due_date)}`);
  for (const row of rows) {
    if (row.user_id !== tx.user_id || !Number.isInteger(row.installment_number) || row.installment_number < 2) throw new Error(`Parcela inválida: ${row.id}`);
    const part = schedule[row.installment_number - 1];
    update('installments', row.id, `invoice_month = ${quote(part.invoice_month)}, due_date = ${quote(part.due_date)}`,
      `transaction_id = ${quote(tx.id)} AND installment_number = ${row.installment_number} AND invoice_month IS NOT DISTINCT FROM ${quote(row.invoice_month)} AND due_date = ${quote(row.due_date)}`);
  }
}
sql.push('COMMIT;');
console.error(`${changed} linhas preparadas. Valores e datas de compra preservados. SQL não executado.`);
console.log(sql.join('\n'));
