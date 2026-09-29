import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BudgetDonut from "./BudgetDonut";
import RecentTransactions from "./RecentTransactions";
import HealthScoreRing from "./HealthScoreRing";
import BottomNav from "@/components/BottomNav";
import InfoTooltip from "@/components/InfoTooltip";
import Avatar from "@/components/Avatar";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableLink } from "@/components/motion/Pressable";
import { generateDueRecurringTransactions } from "@/lib/recurring";
import { getReserveStatus } from "@/lib/reserve";
import { computeHealthScore } from "@/lib/healthScore";
import { isBudgetAlert, getDebtAlerts, getNotifications } from "@/lib/notifications";
import { monthChange } from "@/lib/finance";

// Dados financeiros nunca podem vir de cache — força a página a buscar tudo
// de novo a cada carregamento (ver também o fetch com no-store em
// lib/supabase/server.ts).
export const dynamic = "force-dynamic";

// Precisa bater com o número de cores em BudgetDonut.tsx (SLICE_STROKE/BG) —
// senão duas categorias diferentes acabam reciclando a mesma cor.
const MAX_CHART_SLICES = 5;

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await generateDueRecurringTransactions(supabase, user.id);
  }

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevFirstDay = new Date(prevMonthRef.getFullYear(), prevMonthRef.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const prevLastDay = new Date(prevMonthRef.getFullYear(), prevMonthRef.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // As consultas abaixo são todas independentes entre si (só dependem da
  // recorrência já ter sido gerada acima) — rodar em paralelo em vez de uma
  // de cada vez é o que mais reduz o tempo de carregamento do dashboard.
  const [
    { data: transactions },
    { data: prevTransactions },
    { data: despesaCategories },
    { data: profile },
    reserveStatus,
    debtAlertsResult,
    notifications,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, occurred_at, category_id, categories(name), origem:accounts!account_id(name), destino:accounts!transfer_account_id(name)"
      )
      .gte("occurred_at", firstDay)
      .lte("occurred_at", lastDay)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("type, amount")
      .gte("occurred_at", prevFirstDay)
      .lte("occurred_at", prevLastDay),
    supabase.from("categories").select("id, name, monthly_budget").eq("type", "despesa"),
    user
      ? supabase.from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    getReserveStatus(supabase),
    getDebtAlerts(supabase),
    getNotifications(supabase),
  ]);

  // Nome real de profiles quando existir; senão cai no prefixo do e-mail
  // (comportamento antigo) — cobre tanto profile ainda não criado (conta
  // anterior à migration 0017, antes do backfill de 0019) quanto nome vazio.
  const displayName = profile?.name?.trim() || user?.email?.split("@")[0] || "";
  const firstName = displayName.split(/\s+/)[0];
  const avatarUrl = profile?.avatar_url ?? null;

  const { investRate, alerts: debtAlerts, allDebts } = debtAlertsResult;

  const recebido =
    transactions
      ?.filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const gasto =
    transactions
      ?.filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const saldo = recebido - gasto;

  // Comparativo com o mês anterior
  const recebidoAnterior =
    prevTransactions
      ?.filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const gastoAnterior =
    prevTransactions
      ?.filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  const saldoAnterior = recebidoAnterior - gastoAnterior;

  const recebidoChange = monthChange(recebido, recebidoAnterior, true);
  const gastoChange = monthChange(gasto, gastoAnterior, false);
  const saldoChange = monthChange(saldo, saldoAnterior, true);

  // Gráfico de gastos por categoria + orçamento
  const spentByCategoryId = new Map<string, number>();
  transactions
    ?.filter((t) => t.type === "despesa" && t.category_id)
    .forEach((t) => {
      const key = t.category_id as string;
      spentByCategoryId.set(key, (spentByCategoryId.get(key) ?? 0) + Number(t.amount));
    });

  // Anel do dashboard: fatia = gasto de CADA categoria de despesa, como
  // fração do total gasto no mês — não depende de orçamento nenhum, então
  // aparece igual independente de categoria ter monthly_budget definido ou
  // não. Orçamento por categoria fica reservado pra um gráfico futuro
  // separado (não entra no anel principal).
  const allSpendingBreakdown = (despesaCategories ?? [])
    .map((c) => ({ id: c.id, name: c.name, spent: spentByCategoryId.get(c.id) ?? 0 }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const chartTotal = allSpendingBreakdown.reduce((sum, c) => sum + c.spent, 0);

  // Alertas de orçamento (feature separada, continua usando monthly_budget)
  const budgetedCategories = (despesaCategories ?? []).filter((c) => c.monthly_budget != null);

  const restSpent = allSpendingBreakdown
    .slice(MAX_CHART_SLICES)
    .reduce((sum, c) => sum + c.spent, 0);

  const chartSlices = [
    ...allSpendingBreakdown.slice(0, MAX_CHART_SLICES),
    ...(restSpent > 0 ? [{ id: "outros", name: "Outros", spent: restSpent }] : []),
  ];

  const budgetAlerts = budgetedCategories
    .map((c) => {
      const budget = Number(c.monthly_budget);
      const spent = spentByCategoryId.get(c.id) ?? 0;
      return { id: c.id, name: c.name, budget, spent, pct: budget > 0 ? spent / budget : 0 };
    })
    .filter((c) => isBudgetAlert(c.spent, c.budget))
    .sort((a, b) => b.pct - a.pct);

  // Sugestão de aporte: heurística simples de 75% da sobra do mês,
  // arredondada pra centena mais próxima — não é recomendação de
  // investimento, só um empurrão pra guardar a maior parte do que sobrou.
  const sugestaoAporte = saldo > 0 ? Math.round((saldo * 0.75) / 100) * 100 : 0;

  // Score de saúde financeira — fórmula documentada em lib/healthScore.ts
  const budgetedCategoriesWithSpent = budgetedCategories.map((c) => ({
    spent: spentByCategoryId.get(c.id) ?? 0,
    budget: Number(c.monthly_budget),
  }));
  const healthScore = computeHealthScore({
    recebido,
    saldo,
    budgetedCategories: budgetedCategoriesWithSpent,
    reserveTotal: reserveStatus.total,
    reserveTarget: reserveStatus.target,
    debts: allDebts.map((d) => ({ monthlyInterestRate: d.monthlyInterestRate })),
    investAnnualRate: investRate,
  });

  const monthLabel = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-sheet bg-forest px-5 py-4">
          <div>
            <p className="text-xs capitalize text-sage-mint">{monthLabel}</p>
            <p className="mt-0.5 font-display text-base text-white">
              Olá, {firstName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PressableLink
              href="/notificacoes"
              aria-label="Notificações"
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-wine px-1 text-[9px] font-medium text-white">
                  {notifications.length}
                </span>
              )}
            </PressableLink>
            <PressableLink
              href="/perfil"
              aria-label="Perfil"
              className="block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/25"
            >
              <Avatar name={displayName} avatarUrl={avatarUrl} size={32} />
            </PressableLink>
          </div>
        </div>

        <div className="rounded-b-sheet bg-sage pb-6 dark:bg-ink">
          {debtAlerts.length > 0 && (
            <StaggerList className="flex flex-col gap-2 px-5 pt-5">
              {debtAlerts.map((d) => (
                <StaggerItem
                  key={d.id}
                  className="rounded-card border border-wine px-3.5 py-2.5 text-xs text-wine dark:border-wine-dark dark:text-wine-dark"
                >
                  ⚠ {d.name} custa {d.debtAnnualRate.toFixed(1)}% a.a., mais que os{" "}
                  {investRate!.toFixed(1)}% a.a. esperados no seu investimento de longo prazo —
                  considere quitar antes de aportar (diferença de {d.gap.toFixed(1)} p.p.).{" "}
                  <Link href="/dividas" className="underline">
                    Simular quitação →
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          <HealthScoreRing result={healthScore} />

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-2.5 px-5 pt-5">
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Recebido</p>
              <p className="mt-1 text-lg font-medium text-forest dark:text-sage-mint">
                <AnimatedNumber value={recebido} format="currency" />
              </p>
              {recebidoChange && (
                <p
                  className={`mt-0.5 text-[11px] ${
                    recebidoChange.good
                      ? "text-forest dark:text-sage-mint"
                      : "text-wine dark:text-wine-dark"
                  }`}
                >
                  {recebidoChange.label}
                </p>
              )}
            </div>
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Gasto</p>
              <p className="mt-1 text-lg font-medium text-wine dark:text-wine-dark">
                <AnimatedNumber value={gasto} format="currency" />
              </p>
              {gastoChange && (
                <p
                  className={`mt-0.5 text-[11px] ${
                    gastoChange.good
                      ? "text-forest dark:text-sage-mint"
                      : "text-wine dark:text-wine-dark"
                  }`}
                >
                  {gastoChange.label}
                </p>
              )}
            </div>
          </div>

          {/* Sobra do mês */}
          <div className="mx-5 mt-3 flex items-center justify-between rounded-card bg-forest px-4 py-3.5">
            <div>
              <p className="text-xs text-sage-mint">Sobra do mês</p>
              <p
                className={`mt-0.5 text-xl font-medium ${
                  saldo >= 0 ? "text-white" : "text-amber"
                }`}
              >
                <AnimatedNumber value={saldo} format="currency" />
              </p>
              {saldoChange && (
                <p
                  className={`mt-0.5 text-[11px] ${
                    saldoChange.good ? "text-sage-mint" : "text-amber"
                  }`}
                >
                  {saldoChange.label}
                </p>
              )}
            </div>
            {sugestaoAporte > 0 && (
              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <p className="text-[11px] text-sage-mint">sugestão de aporte</p>
                  <InfoTooltip message="Sugestão simples com base na sobra do mês — não é recomendação de investimento." />
                </div>
                <p className="mt-0.5 text-base font-medium text-amber">
                  <AnimatedNumber value={sugestaoAporte} format="currency" />
                </p>
              </div>
            )}
          </div>

          {/* Navegação pros demais módulos agora vive só na barra inferior:
              "+" pra criar algo novo, ícone de menu pro painel de consulta —
              ver components/BottomNav.tsx. */}

          <BudgetDonut slices={chartSlices} chartTotal={chartTotal} alerts={budgetAlerts} />

          {/* Lançamentos recentes */}
          <div className="mt-5 px-5">
            <p className="mb-2 text-xs text-text-muted dark:text-text-muted-dark">
              Lançamentos deste mês
            </p>
            <RecentTransactions transactions={transactions ?? []} />
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
