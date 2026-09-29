import type { SupabaseClient } from "@supabase/supabase-js";
import { goalMonthlyRequirement } from "./finance";

export type Notification = {
  id: string;
  kind: "orcamento" | "vencimento" | "meta_em_risco" | "divida_cara";
  critical: boolean; // true = estilo preenchido (mais urgente), false = contorno
  message: string;
  href: string;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Regra única pra "categoria perto/estourando o orçamento" — usada tanto
// pelo anel do dashboard (`app/dashboard/BudgetDonut.tsx`) quanto pelo
// centro de notificações, pra nunca divergir sobre o que conta como alerta.
export function isBudgetAlert(spent: number, budget: number) {
  return budget > 0 && spent / budget >= 0.9;
}

// Dívidas mais caras que o retorno esperado do investimento de longo prazo
// — mesmo cálculo do alerta "quitar antes de investir" (Wave 3), extraído
// aqui pra ser reaproveitado tanto no dashboard quanto nas notificações.
export async function getDebtAlerts(supabase: SupabaseClient) {
  const { data: debts } = await supabase
    .from("debts")
    .select("id, name, monthly_interest_rate")
    .gt("balance", 0);

  const { data: profile } = await supabase
    .from("investment_profiles")
    .select("expected_annual_rate")
    .eq("type", "longo_prazo")
    .maybeSingle();

  const investRate = profile != null ? Number(profile.expected_annual_rate) : null;
  const allDebts = (debts ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    monthlyInterestRate: Number(d.monthly_interest_rate),
  }));

  if (investRate == null) {
    return {
      investRate: null as number | null,
      alerts: [] as { id: string; name: string; debtAnnualRate: number; gap: number }[],
      allDebts,
    };
  }

  const alerts = allDebts
    .map((d) => {
      const debtAnnualRate = (Math.pow(1 + d.monthlyInterestRate / 100, 12) - 1) * 100;
      return { id: d.id, name: d.name, debtAnnualRate, gap: debtAnnualRate - investRate };
    })
    .filter((d) => d.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  return { investRate, alerts, allDebts };
}

// "Ritmo atual de contribuição" pras metas: como `goals` não guarda um
// histórico de aportes (só o valor atual), usamos como proxy a média real
// de saldo (recebido − gasto) dos últimos `monthsBack` meses com
// lançamento — é uma simplificação deliberada, documentada aqui pra não
// parecer coincidência.
async function averageMonthlySaldo(supabase: SupabaseClient, monthsBack: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, occurred_at")
    .in("type", ["receita", "despesa"])
    .gte("occurred_at", start.toISOString().slice(0, 10));

  const byMonth = new Map<string, number>();
  (data ?? []).forEach((t) => {
    const key = (t.occurred_at as string).slice(0, 7);
    const delta = t.type === "receita" ? Number(t.amount) : -Number(t.amount);
    byMonth.set(key, (byMonth.get(key) ?? 0) + delta);
  });

  if (byMonth.size === 0) return 0;
  return Array.from(byMonth.values()).reduce((sum, v) => sum + v, 0) / byMonth.size;
}

// Centro de notificações: junta, sob demanda (sem job de fundo, mesmo
// espírito do resto do app), os 4 tipos de aviso automático descritos no
// backlog da Wave 4.
export async function getNotifications(supabase: SupabaseClient): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const today = todayISO();

  // 1) Categoria perto/estourando o orçamento do mês
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: despesas } = await supabase
    .from("transactions")
    .select("amount, category_id")
    .eq("type", "despesa")
    .gte("occurred_at", firstDay)
    .lte("occurred_at", lastDay);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, monthly_budget")
    .eq("type", "despesa")
    .not("monthly_budget", "is", null);

  const spentByCategory = new Map<string, number>();
  (despesas ?? []).forEach((t) => {
    if (!t.category_id) return;
    spentByCategory.set(
      t.category_id as string,
      (spentByCategory.get(t.category_id as string) ?? 0) + Number(t.amount)
    );
  });

  (categories ?? []).forEach((c) => {
    const spent = spentByCategory.get(c.id as string) ?? 0;
    const budget = Number(c.monthly_budget);
    if (!isBudgetAlert(spent, budget)) return;
    const over = spent >= budget;
    notifications.push({
      id: `orcamento-${c.id}`,
      kind: "orcamento",
      critical: over,
      message: `${over ? "Orçamento estourado" : "Quase no limite"}: ${c.name} usou ${Math.round(
        (spent / budget) * 100
      )}% do orçamento (${currency(spent)} de ${currency(budget)}).`,
      href: "/categorias",
    });
  });

  // 2) Conta ou parcela vencendo nos próximos 3 dias (ou já atrasada)
  const in3Days = addDaysISO(3);

  const { data: dueBills } = await supabase
    .from("transactions")
    .select("id, description, amount, due_date, categories(name)")
    .in("status", ["pendente", "atrasado"])
    .not("due_date", "is", null)
    .lte("due_date", in3Days);

  (dueBills ?? []).forEach((t) => {
    const dueDate = t.due_date as string;
    const overdue = dueDate < today;
    const label = t.description || (t.categories as any)?.name || "Lançamento";
    notifications.push({
      id: `vencimento-${t.id}`,
      kind: "vencimento",
      critical: overdue,
      message: `${overdue ? "Atrasado" : "Vence em breve"}: ${label} (${currency(
        Number(t.amount)
      )}) — ${dateLabel(dueDate)}.`,
      href: "/contas-a-pagar",
    });
  });

  const { data: dueInstallments } = await supabase
    .from("installments")
    .select("id, amount, due_date, transactions!inner(description, account_id)")
    .gte("due_date", today)
    .lte("due_date", in3Days);

  (dueInstallments ?? []).forEach((i) => {
    const tx = i.transactions as unknown as { description: string | null; account_id: string | null };
    notifications.push({
      id: `parcela-${i.id}`,
      kind: "vencimento",
      critical: false,
      message: `Parcela vencendo: ${tx?.description || "Compra parcelada"} (${currency(
        Number(i.amount)
      )}) — ${dateLabel(i.due_date as string)}.`,
      href: tx?.account_id ? `/cartoes/${tx.account_id}` : "/contas",
    });
  });

  // 3) Meta em risco de não bater o prazo no ritmo atual
  const { data: goals } = await supabase
    .from("goals")
    .select("id, name, target_amount, current_amount, target_date");

  if (goals && goals.length > 0) {
    const avgMonthlySaldo = await averageMonthlySaldo(supabase, 3);

    goals.forEach((g) => {
      const remaining = Math.max(Number(g.target_amount) - Number(g.current_amount), 0);
      if (remaining === 0) return; // já bateu a meta

      const perMonth = goalMonthlyRequirement(
        Number(g.target_amount),
        Number(g.current_amount),
        g.target_date as string
      );
      if (perMonth <= avgMonthlySaldo) return; // no ritmo atual, dá pra chegar lá

      const overdue = (g.target_date as string) < today;
      notifications.push({
        id: `meta-${g.id}`,
        kind: "meta_em_risco",
        critical: overdue,
        message: `Meta "${g.name}" em risco: precisa de ${currency(
          perMonth
        )}/mês pra chegar no prazo, mas sua média de sobra dos últimos meses é ${currency(
          avgMonthlySaldo
        )}/mês.`,
        href: "/metas",
      });
    });
  }

  // 4) Dívida cara (reaproveita o alerta da Wave 3)
  const { investRate, alerts: debtAlerts } = await getDebtAlerts(supabase);
  debtAlerts.forEach((d) => {
    notifications.push({
      id: `divida-${d.id}`,
      kind: "divida_cara",
      critical: false,
      message: `${d.name} custa ${d.debtAnnualRate.toFixed(1)}% a.a., mais que os ${investRate!.toFixed(
        1
      )}% a.a. esperados do seu investimento de longo prazo — considere quitar antes de investir.`,
      href: "/dividas",
    });
  });

  // Mais urgentes (critical) primeiro
  return notifications.sort((a, b) => Number(b.critical) - Number(a.critical));
}
