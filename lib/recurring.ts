import { canRepeatTransaction } from "./card-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";

// Meses são clampeados no último dia quando o mês seguinte é mais curto
// (ex.: lançamento no dia 31 de janeiro gera o de fevereiro no dia 28/29).
// Exportado pra ser reaproveitado na projeção de fluxo de caixa
// (`lib/cashFlow.ts`), que precisa da mesma lógica pra simular ocorrências
// futuras de lançamentos recorrentes sem de fato gravá-las no banco.
export function addOneMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextMonthIndex = m; // m vem 1-12, então já é o índice 0-based do mês seguinte
  const lastDayOfNextMonth = new Date(y, nextMonthIndex + 1, 0).getDate();
  const day = Math.min(d, lastDayOfNextMonth);
  return new Date(y, nextMonthIndex, day).toISOString().slice(0, 10);
}

// Limite de segurança contra loop infinito (2 anos de meses em atraso).
const MAX_MONTHS_TO_BACKFILL = 24;

// Gera, sob demanda, os lançamentos recorrentes que ainda faltam até o mês
// atual. Idempotente: cada cópia guarda `recurring_source_id` apontando para
// o lançamento de onde veio, então rodar isso várias vezes no mesmo mês
// nunca duplica.
export async function generateDueRecurringTransactions(
  supabase: SupabaseClient,
  userId: string
) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  for (let i = 0; i < MAX_MONTHS_TO_BACKFILL; i++) {
    const { data: pending } = await supabase
      .from("transactions")
      .select(
        "id, type, amount, description, category_id, account_id, transfer_account_id, occurred_at, due_date, removed_card, removed_transfer_card, origem:accounts!account_id(archived_at), destino:accounts!transfer_account_id(archived_at)"
      )
      .eq("user_id", userId)
      .eq("is_recurring", true)
      .lt("occurred_at", currentMonthStart);

    if (!pending || pending.length === 0) break;

    const { data: children } = await supabase
      .from("transactions")
      .select("recurring_source_id")
      .in(
        "recurring_source_id",
        pending.map((p) => p.id)
      );

    const alreadyContinued = new Set((children ?? []).map((c) => c.recurring_source_id));
    const toContinue = pending.filter((p) => !alreadyContinued.has(p.id) && canRepeatTransaction(p));

    if (toContinue.length === 0) break;

    const inserts = toContinue.map((p) => ({
      user_id: userId,
      type: p.type,
      amount: p.amount,
      description: p.description,
      category_id: p.category_id,
      account_id: p.account_id,
      transfer_account_id: p.transfer_account_id,
      occurred_at: addOneMonth(p.occurred_at),
      due_date: p.due_date ? addOneMonth(p.due_date) : null,
      is_recurring: true,
      recurring_source_id: p.id,
    }));

    await supabase.from("transactions").insert(inserts);
  }
}
