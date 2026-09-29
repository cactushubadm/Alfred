import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { computeAndSnapshotNetWorth } from "@/lib/netWorth";
import NetWorthChart from "./NetWorthChart";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import { PressableLink } from "@/components/motion/Pressable";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PatrimonioPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = user
    ? await computeAndSnapshotNetWorth(supabase, user.id)
    : {
        assets: 0,
        liabilities: 0,
        netWorth: 0,
        contasBalance: 0,
        reservaTotal: 0,
        longoPrazoBalance: 0,
        debtsSum: 0,
        installmentsSum: 0,
      };

  const { data: history } = await supabase
    .from("net_worth_snapshots")
    .select("month_date, net_worth, estimated")
    .order("month_date", { ascending: true })
    .limit(24);

  const chartData = (history ?? []).map((h) => ({
    monthDate: h.month_date as string,
    netWorth: Number(h.net_worth),
    estimated: Boolean(h.estimated),
  }));

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <PressableLink href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </PressableLink>
          <p className="font-display text-lg text-white">Patrimônio líquido</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div
            className={`rounded-card px-4 py-3.5 text-center ${
              result.netWorth >= 0 ? "bg-forest" : "bg-wine"
            }`}
          >
            <p className="text-xs text-sage-mint">Patrimônio líquido hoje</p>
            <p className="mt-0.5 text-2xl font-medium text-white">
              <AnimatedNumber value={result.netWorth} format="currency" />
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Ativos</p>
              <p className="mt-1 text-lg font-medium text-forest dark:text-sage-mint">
                <AnimatedNumber value={result.assets} format="currency" />
              </p>
              <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-text-muted dark:text-text-muted-dark">
                <p>Saldo em contas: {currency(result.contasBalance)}</p>
                <p>Reserva de emergência: {currency(result.reservaTotal)}</p>
                <p>Investimento de longo prazo: {currency(result.longoPrazoBalance)}</p>
              </div>
            </div>
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Passivos</p>
              <p className="mt-1 text-lg font-medium text-wine dark:text-wine-dark">
                <AnimatedNumber value={result.liabilities} format="currency" />
              </p>
              <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-text-muted dark:text-text-muted-dark">
                <p>Dívidas: {currency(result.debtsSum)}</p>
                <p>Parcelas futuras (cartão): {currency(result.installmentsSum)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {chartData.length > 1 ? (
              <NetWorthChart data={chartData} />
            ) : (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Volte aqui nos próximos meses pra ver a evolução do seu patrimônio ao longo do
                tempo.
              </p>
            )}
          </div>

          <p className="mt-3 text-[10px] text-text-muted dark:text-text-muted-dark">
            O histórico é salvo automaticamente cada vez que você abre essa tela. Meses sem
            visita são preenchidos repetindo o último valor calculado (barra mais clara no
            gráfico), pra não deixar buraco na evolução — assim que você voltar aqui, o mês
            atual é recalculado com os valores reais.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <PressableLink
              href="/dividas"
              className="block rounded-full border border-line-soft py-2.5 text-center text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
            >
              Ver dívidas →
            </PressableLink>
            <PressableLink
              href="/investimentos"
              className="block rounded-full border border-line-soft py-2.5 text-center text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
            >
              Ver investimentos →
            </PressableLink>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
