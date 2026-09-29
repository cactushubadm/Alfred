import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { monthChange } from "@/lib/finance";
import {
  getOrGenerateMonthlyReport,
  listReportMonths,
  currentMonthDate,
} from "@/lib/monthlyReport";
import { projectMonthCashFlow, type ProjectedItem } from "@/lib/cashFlow";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableLink } from "@/components/motion/Pressable";

// Quantos meses no futuro dá pra navegar — além disso a previsão (baseada só
// em parcelas/recorrentes/contas já cadastradas) fica vazia demais pra valer
// a pena mostrar.
const FUTURE_MONTHS_CAP = 24;

const SOURCE_LABEL: Record<ProjectedItem["source"], string> = {
  recorrente: "Recorrente",
  parcela: "Parcela",
  pendente: "Pendente",
};

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toMonthDate(monthInput: string) {
  // "YYYY-MM" (do <input type="month">) -> "YYYY-MM-01" — o `max` do input
  // já guia o usuário, mas uma URL editada à mão não passa por ele, então o
  // teto também é aplicado aqui.
  if (!/^\d{4}-\d{2}$/.test(monthInput)) return currentMonthDate();
  const monthDate = `${monthInput}-01`;
  const maxMonthDate = shiftMonth(currentMonthDate(), FUTURE_MONTHS_CAP);
  return monthDate > maxMonthDate ? maxMonthDate : monthDate;
}

function toMonthInput(monthDate: string) {
  return monthDate.slice(0, 7);
}

function shiftMonth(monthDate: string, delta: number) {
  const [y, m] = monthDate.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}-01`;
}

function monthLabel(monthDate: string) {
  const [y, m] = monthDate.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monthDate = searchParams.month ? toMonthDate(searchParams.month) : currentMonthDate();
  const isCurrent = monthDate === currentMonthDate();
  const isFuture = monthDate > currentMonthDate();
  const maxMonthDate = shiftMonth(currentMonthDate(), FUTURE_MONTHS_CAP);
  const canGoNext = monthDate < maxMonthDate;

  const [report, forecast, availableMonths] = await Promise.all([
    user && !isFuture ? getOrGenerateMonthlyReport(supabase, user.id, monthDate) : Promise.resolve(null),
    user && isFuture ? projectMonthCashFlow(supabase, monthDate) : Promise.resolve(null),
    listReportMonths(supabase),
  ]);
  const allMonths = Array.from(new Set([currentMonthDate(), ...availableMonths])).sort(
    (a, b) => (a < b ? 1 : -1)
  );

  const saldoChange =
    report && report.saldoAnterior != null ? monthChange(report.saldo, report.saldoAnterior, true) : null;

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Relatório mensal</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="flex items-center justify-between gap-2">
            <PressableLink
              href={`/relatorios?month=${toMonthInput(shiftMonth(monthDate, -1))}`}
              className="shrink-0 rounded-full border border-line-soft px-3.5 py-2 text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
            >
              Anterior
            </PressableLink>
            <p className="min-w-0 flex-1 truncate text-center font-display text-sm capitalize text-ink dark:text-sage">
              {monthLabel(monthDate)}
            </p>
            {canGoNext ? (
              <PressableLink
                href={`/relatorios?month=${toMonthInput(shiftMonth(monthDate, 1))}`}
                className="shrink-0 rounded-full border border-line-soft px-3.5 py-2 text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
              >
                Próximo
              </PressableLink>
            ) : (
              <span className="shrink-0 rounded-full border border-line-soft px-3.5 py-2 text-xs font-medium text-text-muted opacity-50 dark:border-text-muted-dark/20 dark:text-text-muted-dark">
                Próximo
              </span>
            )}
          </div>

          {!user ? (
            <p className="mt-4 rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Faça login pra ver o relatório.
            </p>
          ) : isFuture ? (
            <>
              <div className="mt-4 flex justify-center">
                <span className="rounded-full border border-dashed border-line-soft px-2 py-0.5 text-[10px] font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark">
                  Previsto
                </span>
              </div>
              <p className="mt-1 text-center text-[11px] text-text-muted dark:text-text-muted-dark">
                Mês futuro — previsão só com o que já é conhecido hoje (recorrentes, parcelas e
                contas a pagar/receber já cadastradas), sem inventar gastos variáveis
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-dashed border-line-soft bg-white/70 px-3.5 py-3 dark:border-text-muted-dark/20 dark:bg-surface-dark/70">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Recebido (previsto)</p>
                  <p className="mt-1 text-lg font-medium text-forest/70 dark:text-sage-mint/70">
                    <AnimatedNumber key={monthDate} value={forecast!.recebido} format="currency" />
                  </p>
                </div>
                <div className="rounded-card border border-dashed border-line-soft bg-white/70 px-3.5 py-3 dark:border-text-muted-dark/20 dark:bg-surface-dark/70">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Gasto (previsto)</p>
                  <p className="mt-1 text-lg font-medium text-wine/70 dark:text-wine-dark/70">
                    <AnimatedNumber key={monthDate} value={forecast!.gasto} format="currency" />
                  </p>
                </div>
              </div>

              <div className="mt-2.5 rounded-card border border-dashed border-forest/40 bg-forest/10 px-4 py-3.5 dark:border-sage-mint/30 dark:bg-sage-mint/10">
                <p className="text-xs text-forest dark:text-sage-mint">Saldo previsto do mês</p>
                <p
                  className={`mt-0.5 text-xl font-medium ${
                    forecast!.saldo >= 0
                      ? "text-forest dark:text-sage-mint"
                      : "text-wine dark:text-wine-dark"
                  }`}
                >
                  <AnimatedNumber key={monthDate} value={forecast!.saldo} format="currency" />
                </p>
              </div>

              <p className="mt-4 text-sm text-ink dark:text-sage">De onde vem essa previsão</p>
              {forecast!.items.length === 0 ? (
                <p className="mt-2.5 rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                  Nada previsto pra esse mês ainda.
                </p>
              ) : (
                <StaggerList key={monthDate} className="mt-2.5 flex flex-col gap-2">
                  {forecast!.items.map((item, i) => (
                    <StaggerItem
                      key={`${item.source}-${item.date}-${i}`}
                      className="flex items-center justify-between rounded-card border border-dashed border-line-soft bg-white/70 px-3.5 py-2.5 dark:border-text-muted-dark/20 dark:bg-surface-dark/70"
                    >
                      <div>
                        <p className="text-sm text-ink dark:text-sage">{item.description}</p>
                        <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                          {dateLabel(item.date)} · {SOURCE_LABEL[item.source]}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-medium ${
                          item.type === "receita"
                            ? "text-forest/70 dark:text-sage-mint/70"
                            : "text-wine/70 dark:text-wine-dark/70"
                        }`}
                      >
                        {item.type === "receita" ? "+" : "-"}
                        {currency(item.amount)}
                      </p>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </>
          ) : (
            <>
              <p className="mt-4 text-center text-[11px] text-text-muted dark:text-text-muted-dark">
                {isCurrent
                  ? "Mês em andamento — atualizado a cada visita"
                  : `Gerado em ${new Date(report!.generatedAt).toLocaleDateString("pt-BR")} (congelado)`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Recebido</p>
                  <p className="mt-1 text-lg font-medium text-forest dark:text-sage-mint">
                    <AnimatedNumber key={monthDate} value={report!.recebido} format="currency" />
                  </p>
                </div>
                <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Gasto</p>
                  <p className="mt-1 text-lg font-medium text-wine dark:text-wine-dark">
                    <AnimatedNumber key={monthDate} value={report!.gasto} format="currency" />
                  </p>
                </div>
              </div>

              <div className="mt-2.5 rounded-card bg-forest px-4 py-3.5">
                <p className="text-xs text-sage-mint">Saldo do mês</p>
                <p className={`mt-0.5 text-xl font-medium ${report!.saldo >= 0 ? "text-white" : "text-amber"}`}>
                  <AnimatedNumber key={monthDate} value={report!.saldo} format="currency" />
                </p>
                {saldoChange ? (
                  <p className={`mt-0.5 text-[11px] ${saldoChange.good ? "text-sage-mint" : "text-amber"}`}>
                    {saldoChange.label}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-sage-mint">Sem mês anterior pra comparar</p>
                )}
              </div>

              <div className="mt-2.5 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                <p className="text-xs text-text-muted dark:text-text-muted-dark">Categoria que mais pesou</p>
                {report!.topCategoryName ? (
                  <p className="mt-1 text-sm font-medium text-ink dark:text-sage">
                    {report!.topCategoryName} — {currency(report!.topCategoryAmount ?? 0)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">Nenhum gasto categorizado nesse mês.</p>
                )}
              </div>

              <div className="mt-2.5 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Score de saúde financeira</p>
                  <p
                    className={`text-sm font-medium ${
                      report!.healthScore == null
                        ? "text-text-muted dark:text-text-muted-dark"
                        : report!.healthScore >= 70
                        ? "text-forest dark:text-sage-mint"
                        : report!.healthScore >= 40
                        ? "text-amber"
                        : "text-wine dark:text-wine-dark"
                    }`}
                  >
                    {report!.healthScore != null ? (
                      <AnimatedNumber key={monthDate} value={report!.healthScore} />
                    ) : (
                      "—"
                    )}
                    /100
                  </p>
                </div>
              </div>

              <div className="mt-2.5 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                <p className="text-xs text-text-muted dark:text-text-muted-dark">Progresso das metas</p>
                {report!.goalsSummary.length === 0 ? (
                  <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted-dark">Nenhuma meta cadastrada.</p>
                ) : (
                  <StaggerList key={monthDate} className="mt-2 flex flex-col gap-2">
                    {report!.goalsSummary.map((g) => (
                      <StaggerItem key={g.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink dark:text-sage">{g.name}</span>
                          <span className="text-text-muted dark:text-text-muted-dark">{Math.round(g.pct)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line-soft dark:bg-text-muted-dark/20">
                          <div
                            className={`h-full rounded-full ${
                              g.pct >= 100 ? "bg-forest dark:bg-sage-mint" : "bg-amber"
                            }`}
                            style={{ width: `${g.pct}%` }}
                          />
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </div>
            </>
          )}

          {user && allMonths.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-text-muted dark:text-text-muted-dark">Histórico de relatórios</p>
              <StaggerList className="flex flex-wrap gap-1.5">
                {allMonths.map((m) => (
                  <StaggerItem key={m}>
                    <PressableLink
                      href={`/relatorios?month=${toMonthInput(m)}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${
                        m === monthDate
                          ? "border-forest bg-forest text-white"
                          : "border-line-soft text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                      }`}
                    >
                      {monthLabel(m)}
                    </PressableLink>
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          )}

          {user && (
            <p className="mt-4 text-[10px] text-text-muted dark:text-text-muted-dark">
              Relatórios ficam só aqui no app por enquanto — envio por e-mail é uma etapa futura,
              quando o serviço de e-mail transacional for configurado.
            </p>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
