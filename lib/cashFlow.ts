import { todaySaoPaulo } from "./cartao";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addOneMonth } from "./recurring";
import { monthBounds } from "./finance";

export type ProjectedItem = {
  date: string;
  type: "receita" | "despesa";
  amount: number;
  description: string;
  source: "recorrente" | "parcela" | "pendente";
  invoiceMonth?: string;
};

function todayISO() {
  return todaySaoPaulo();
}

function addDays(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Projeta o fluxo de caixa dos próximos `horizonDays`, somando três fontes:
// 1) lançamentos recorrentes ainda não gerados (simulados mês a mês a
//    partir da ponta de cada cadeia, sem gravar nada no banco);
// 2) parcelas futuras já comprometidas em `installments`;
// 3) contas a pagar/receber (`status` pendente/atrasado) com vencimento
//    dentro do período.
export async function projectCashFlow(
  supabase: SupabaseClient,
  horizonDays: number
): Promise<ProjectedItem[]> {
  const today = todayISO();
  const horizonEnd = addDays(today, horizonDays);
  const items: ProjectedItem[] = [];

  // As 3 fontes são independentes entre si — rodam em paralelo.
  const [{ data: recurring }, { data: installmentRows }, { data: pending }, { data: cardPurchases }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount, description, occurred_at, recurring_source_id, categories(name)")
      .eq("is_recurring", true)
      .in("type", ["receita", "despesa"]),
    supabase
      .from("installments")
      .select("amount, due_date, invoice_month, transactions!inner(description)")
      .gte("due_date", today)
      .lte("due_date", horizonEnd),
    supabase
      .from("transactions")
      .select("type, amount, description, due_date, categories(name)")
      .in("status", ["pendente", "atrasado"])
      .is("invoice_month", null)
      .gte("due_date", today)
      .lte("due_date", horizonEnd),
    supabase.from("transactions").select("amount, description, invoice_month, card_due_date")
      .not("invoice_month", "is", null).gte("card_due_date", today).lte("card_due_date", horizonEnd),
  ]);

  // 1. Recorrentes ainda não materializados
  const childOf = new Set(
    (recurring ?? []).filter((r) => r.recurring_source_id).map((r) => r.recurring_source_id)
  );
  const chainTips = (recurring ?? []).filter((r) => !childOf.has(r.id));

  chainTips.forEach((leaf) => {
    let cursor = addOneMonth(leaf.occurred_at as string);
    while (cursor <= horizonEnd) {
      if (cursor >= today) {
        items.push({
          date: cursor,
          type: leaf.type as "receita" | "despesa",
          amount: Number(leaf.amount),
          description: leaf.description || (leaf.categories as any)?.name || "Recorrente",
          source: "recorrente",
        });
      }
      cursor = addOneMonth(cursor);
    }
  });

  // 2. Parcelas futuras de cartão
  (installmentRows ?? []).forEach((row) => {
    items.push({
      date: row.due_date as string,
      type: "despesa",
      amount: Number(row.amount),
      description: (row.transactions as any)?.description || "Parcela do cartão",
      source: "parcela",
      invoiceMonth: row.invoice_month as string,
    });
  });

  (cardPurchases ?? []).forEach(row => items.push({
    date: row.card_due_date, type: "despesa", amount: Number(row.amount),
    description: row.description || "Compra no cartão", source: "parcela", invoiceMonth: row.invoice_month,
  }));

  // 3. Contas a pagar/receber dentro do período
  (pending ?? []).forEach((t) => {
    items.push({
      date: t.due_date as string,
      type: t.type as "receita" | "despesa",
      amount: Number(t.amount),
      description: t.description || (t.categories as any)?.name || "Lançamento",
      source: "pendente",
    });
  });

  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

export type MonthCashFlowForecast = {
  recebido: number;
  gasto: number;
  saldo: number;
  items: ProjectedItem[];
};

// Previsão pra um mês futuro específico do relatório mensal — reaproveita a
// mesma projeção de cima (recorrentes + parcelas + contas a pagar/receber)
// e só recorta pro intervalo do mês pedido, em vez de duplicar a lógica de
// quais fontes entram na previsão.
export async function projectMonthCashFlow(
  supabase: SupabaseClient,
  monthDate: string
): Promise<MonthCashFlowForecast> {
  const { first, last } = monthBounds(monthDate);
  const today = todayISO();

  if (last < today) {
    return { recebido: 0, gasto: 0, saldo: 0, items: [] };
  }

  const horizonDays = Math.ceil(
    (new Date(last + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
  );
  const allItems = await projectCashFlow(supabase, Math.max(horizonDays, 1));
  const items = allItems.filter((item) => item.date >= first && item.date <= last);

  const recebido = items.filter((i) => i.type === "receita").reduce((sum, i) => sum + i.amount, 0);
  const gasto = items.filter((i) => i.type === "despesa").reduce((sum, i) => sum + i.amount, 0);

  return { recebido, gasto, saldo: recebido - gasto, items };
}
