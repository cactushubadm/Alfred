import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { generateDueRecurringTransactions } from "@/lib/recurring";
import { projectCashFlow, type ProjectedItem } from "@/lib/cashFlow";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateISO: string, days: number) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const WINDOWS = [30, 60, 90];

const SOURCE_LABEL: Record<ProjectedItem["source"], string> = {
  recorrente: "Recorrente",
  parcela: "Parcela",
  pendente: "Pendente",
};

export default async function FluxoDeCaixaPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await generateDueRecurringTransactions(supabase, user.id);
  }

  const items = await projectCashFlow(supabase, 90);
  const today = todayISO();

  const windowSummaries = WINDOWS.map((days) => {
    const end = addDays(today, days);
    const inWindow = items.filter((i) => i.date <= end);
    const entradas = inWindow
      .filter((i) => i.type === "receita")
      .reduce((sum, i) => sum + i.amount, 0);
    const saidas = inWindow
      .filter((i) => i.type === "despesa")
      .reduce((sum, i) => sum + i.amount, 0);
    return { days, entradas, saidas, saldo: entradas - saidas };
  });

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Fluxo de caixa projetado</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="grid grid-cols-3 gap-2">
            {windowSummaries.map((w) => (
              <div key={w.days} className="rounded-card bg-white px-2.5 py-3 text-center dark:bg-surface-dark">
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark">{w.days} dias</p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    w.saldo >= 0 ? "text-forest dark:text-sage-mint" : "text-wine dark:text-wine-dark"
                  }`}
                >
                  <AnimatedNumber value={w.saldo} format="currency" />
                </p>
                <p className="mt-1 text-[10px] text-forest dark:text-sage-mint">+{currency(w.entradas)}</p>
                <p className="text-[10px] text-wine dark:text-wine-dark">-{currency(w.saidas)}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-text-muted dark:text-text-muted-dark">
            Projeção com base no que já está previsto hoje: lançamentos recorrentes, parcelas
            futuras de cartão e contas a pagar/receber com vencimento no período — não considera
            gastos novos que ainda vão surgir.
          </p>

          <p className="mt-5 text-sm text-ink dark:text-sage">Próximos lançamentos previstos</p>
          {items.length === 0 ? (
            <p className="mt-2.5 rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Nada previsto pros próximos 90 dias.
            </p>
          ) : (
            <StaggerList className="mt-2.5 flex flex-col gap-2">
              {items.map((item, i) => (
                <StaggerItem
                  key={`${item.source}-${item.date}-${i}`}
                  className="flex items-center justify-between rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark"
                >
                  <div>
                    <p className="text-sm text-ink dark:text-sage">{item.description}</p>
                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                      {dateLabel(item.date)} · {SOURCE_LABEL[item.source]}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      item.type === "receita" ? "text-forest dark:text-sage-mint" : "text-wine dark:text-wine-dark"
                    }`}
                  >
                    {item.type === "receita" ? "+" : "-"}
                    {currency(item.amount)}
                  </p>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
