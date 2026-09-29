import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHealthScore } from "./healthScore";
import { getReserveStatus } from "./reserve";
import { getDebtAlerts } from "./notifications";
import { pad2, monthBounds } from "./finance";

export type MonthlyReport = {
  monthDate: string;
  recebido: number;
  gasto: number;
  saldo: number;
  saldoAnterior: number | null;
  topCategoryName: string | null;
  topCategoryAmount: number | null;
  goalsSummary: { name: string; pct: number }[];
  healthScore: number | null;
  generatedAt: string;
};

function prevMonthDate(monthDate: string) {
  const [y, m] = monthDate.split("-").map(Number);
  const total = y * 12 + (m - 1) - 1;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}-01`;
}

export function currentMonthDate() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
}

async function monthTotals(supabase: SupabaseClient, first: string, last: string) {
  const { data } = await supabase
    .from("transactions")
    .select("type, amount, category_id, categories(name)")
    .in("type", ["receita", "despesa"])
    .gte("occurred_at", first)
    .lte("occurred_at", last);

  const recebido = (data ?? [])
    .filter((t) => t.type === "receita")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const despesaRows = (data ?? []).filter((t) => t.type === "despesa");
  const gasto = despesaRows.reduce((sum, t) => sum + Number(t.amount), 0);

  const byCategory = new Map<string, { name: string; amount: number }>();
  despesaRows.forEach((t) => {
    if (!t.category_id) return;
    const name = (t.categories as any)?.name ?? "Sem categoria";
    const entry = byCategory.get(t.category_id as string) ?? { name, amount: 0 };
    entry.amount += Number(t.amount);
    byCategory.set(t.category_id as string, entry);
  });

  const top = Array.from(byCategory.values()).reduce<{ name: string; amount: number } | null>(
    (best, v) => (!best || v.amount > best.amount ? v : best),
    null
  );

  return { recebido, gasto, saldo: recebido - gasto, top };
}

// Gera (ou regera) o relatório de um mês a partir dos dados reais — sempre
// preciso pra recebido/gasto/saldo/categoria (vêm de `occurred_at`, uma
// data real), mas o progresso das metas e o score de saúde financeira só
// existem como "estado atual", sem histórico próprio (mesma limitação de
// `goals.current_amount` documentada em lib/notifications.ts) — então o
// que fica gravado é o estado no MOMENTO em que o relatório foi gerado.
export async function generateMonthlyReport(
  supabase: SupabaseClient,
  userId: string,
  monthDate: string
): Promise<MonthlyReport> {
  const { first, last } = monthBounds(monthDate);
  const prevBounds = monthBounds(prevMonthDate(monthDate));

  // As 7 consultas abaixo são independentes entre si — só o upsert final
  // depende de todas — então rodam em paralelo em vez de uma por vez.
  const [current, prev, { data: categories }, { data: despesasDoMes }, { data: goals }, reserveStatus, debtAlertsResult] =
    await Promise.all([
      monthTotals(supabase, first, last),
      monthTotals(supabase, prevBounds.first, prevBounds.last),
      supabase
        .from("categories")
        .select("id, monthly_budget")
        .eq("type", "despesa")
        .not("monthly_budget", "is", null),
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("type", "despesa")
        .gte("occurred_at", first)
        .lte("occurred_at", last),
      supabase.from("goals").select("name, target_amount, current_amount"),
      getReserveStatus(supabase),
      getDebtAlerts(supabase),
    ]);

  const hasPrevData = prev.recebido !== 0 || prev.gasto !== 0;
  const { investRate, allDebts } = debtAlertsResult;

  const spentByCat = new Map<string, number>();
  (despesasDoMes ?? []).forEach((t) => {
    if (!t.category_id) return;
    spentByCat.set(t.category_id as string, (spentByCat.get(t.category_id as string) ?? 0) + Number(t.amount));
  });

  const budgetedCategories = (categories ?? []).map((c) => ({
    spent: spentByCat.get(c.id as string) ?? 0,
    budget: Number(c.monthly_budget),
  }));

  const goalsSummary = (goals ?? []).map((g) => ({
    name: g.name as string,
    pct:
      Number(g.target_amount) > 0
        ? Math.min(Number(g.current_amount) / Number(g.target_amount), 1) * 100
        : 0,
  }));

  const { score } = computeHealthScore({
    recebido: current.recebido,
    saldo: current.saldo,
    budgetedCategories,
    reserveTotal: reserveStatus.total,
    reserveTarget: reserveStatus.target,
    debts: allDebts.map((d) => ({ monthlyInterestRate: d.monthlyInterestRate })),
    investAnnualRate: investRate,
  });

  const row = {
    user_id: userId,
    month_date: monthDate,
    recebido: current.recebido,
    gasto: current.gasto,
    saldo: current.saldo,
    saldo_anterior: hasPrevData ? prev.saldo : null,
    top_category_name: current.top?.name ?? null,
    top_category_amount: current.top?.amount ?? null,
    goals_summary: goalsSummary,
    health_score: score,
  };

  const { data: saved } = await supabase
    .from("monthly_reports")
    .upsert(row, { onConflict: "user_id,month_date" })
    .select("created_at")
    .maybeSingle();

  return {
    monthDate,
    recebido: row.recebido,
    gasto: row.gasto,
    saldo: row.saldo,
    saldoAnterior: row.saldo_anterior,
    topCategoryName: row.top_category_name,
    topCategoryAmount: row.top_category_amount,
    goalsSummary: row.goals_summary,
    healthScore: row.health_score,
    generatedAt: saved?.created_at ?? new Date().toISOString(),
  };
}

// Mês corrente é sempre regerado (ainda em andamento); meses passados, uma
// vez gerados, ficam congelados — não recomputamos metas/score de novo
// pra não fingir uma precisão histórica que os dados não têm.
export async function getOrGenerateMonthlyReport(
  supabase: SupabaseClient,
  userId: string,
  monthDate: string
): Promise<MonthlyReport> {
  if (monthDate !== currentMonthDate()) {
    const { data: existing } = await supabase
      .from("monthly_reports")
      .select(
        "recebido, gasto, saldo, saldo_anterior, top_category_name, top_category_amount, goals_summary, health_score, created_at"
      )
      .eq("month_date", monthDate)
      .maybeSingle();

    if (existing) {
      return {
        monthDate,
        recebido: Number(existing.recebido),
        gasto: Number(existing.gasto),
        saldo: Number(existing.saldo),
        saldoAnterior: existing.saldo_anterior != null ? Number(existing.saldo_anterior) : null,
        topCategoryName: existing.top_category_name,
        topCategoryAmount:
          existing.top_category_amount != null ? Number(existing.top_category_amount) : null,
        goalsSummary: existing.goals_summary ?? [],
        healthScore: existing.health_score,
        generatedAt: existing.created_at,
      };
    }
  }

  return generateMonthlyReport(supabase, userId, monthDate);
}

export async function listReportMonths(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("monthly_reports")
    .select("month_date")
    .order("month_date", { ascending: false });
  return (data ?? []).map((r) => r.month_date as string);
}
