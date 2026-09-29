"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Isola n (em meses) de VF = VP(1+i)^n + PMT*[((1+i)^n - 1)/i]
// retorna null quando a meta é inatingível com esses parâmetros
function monthsToReachGoal(
  target: number,
  presentValue: number,
  monthlyContribution: number,
  monthlyRate: number
): number | null {
  if (presentValue >= target) return 0;

  if (monthlyRate === 0) {
    if (monthlyContribution <= 0) return null;
    return (target - presentValue) / monthlyContribution;
  }

  const denom = presentValue + monthlyContribution / monthlyRate;
  const numer = target + monthlyContribution / monthlyRate;
  if (denom <= 0 || numer <= 0) return null;

  const ratio = numer / denom;
  if (ratio <= 0) return null;

  const n = Math.log(ratio) / Math.log(1 + monthlyRate);
  return n > 0 ? n : 0;
}

export default function AposentadoriaPage() {
  const supabase = createClient();

  const [desiredIncome, setDesiredIncome] = useState("0.00");
  const [withdrawalRate, setWithdrawalRate] = useState("4");
  const [inflationRate, setInflationRate] = useState("4.5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [longoPrazo, setLongoPrazo] = useState<{
    balance: number;
    contribution: number;
    rate: number;
  } | null>(null);

  // Comparador de cenários: "e se eu aportasse mais por mês" — só
  // simulação local, não é persistido
  const [extraContribution, setExtraContribution] = useState("100.00");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("retirement_plans")
      .select("desired_monthly_income, withdrawal_rate, inflation_rate")
      .maybeSingle()
      .then(({ data }) => {
        setDesiredIncome(data ? Number(data.desired_monthly_income).toFixed(2) : "0.00");
        setWithdrawalRate(data ? String(Number(data.withdrawal_rate) * 100) : "4");
        setInflationRate(data ? String(Number(data.inflation_rate)) : "4.5");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    supabase
      .from("investment_profiles")
      .select("current_balance, monthly_contribution, expected_annual_rate")
      .eq("type", "longo_prazo")
      .maybeSingle()
      .then(({ data }) => {
        setLongoPrazo({
          balance: data ? Number(data.current_balance) : 0,
          contribution: data ? Number(data.monthly_contribution) : 0,
          rate: data ? Number(data.expected_annual_rate) : 0,
        });
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login novamente.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("retirement_plans").upsert(
      {
        user_id: user.id,
        desired_monthly_income: Number(desiredIncome) || 0,
        withdrawal_rate: (Number(withdrawalRate.replace(",", ".")) || 0) / 100,
        inflation_rate: Number(inflationRate.replace(",", ".")) || 0,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  const withdrawalFraction = (Number(withdrawalRate.replace(",", ".")) || 0) / 100;
  const desiredIncomeNum = Number(desiredIncome) || 0;
  const patrimonioNecessario =
    withdrawalFraction > 0 ? (desiredIncomeNum * 12) / withdrawalFraction : 0;

  const patrimonioAtual = longoPrazo?.balance ?? 0;
  const faltam = Math.max(patrimonioNecessario - patrimonioAtual, 0);
  const jaAtingiu = patrimonioNecessario > 0 && patrimonioAtual >= patrimonioNecessario;

  const pmt = longoPrazo?.contribution ?? 0;
  const monthlyRate = Math.pow(1 + (longoPrazo?.rate ?? 0) / 100, 1 / 12) - 1;
  const monthsNeeded = jaAtingiu
    ? 0
    : monthsToReachGoal(patrimonioNecessario, patrimonioAtual, pmt, monthlyRate);
  const yearsNeeded = monthsNeeded != null ? monthsNeeded / 12 : null;

  const inflationNum = Number(inflationRate.replace(",", ".")) || 0;
  const nominalAtGoal =
    yearsNeeded != null ? patrimonioNecessario * Math.pow(1 + inflationNum / 100, yearsNeeded) : null;

  // Comparador de cenários: aporte atual, +extra e +2×extra lado a lado
  const extraNum = Number(extraContribution) || 0;
  const scenarios = [
    { key: "atual", label: "Atual", extra: 0 },
    { key: "extra1", label: `+${currency(extraNum)}`, extra: extraNum },
    { key: "extra2", label: `+${currency(extraNum * 2)}`, extra: extraNum * 2 },
  ].map((s) => {
    const scenarioPmt = pmt + s.extra;
    const scenarioMonths = jaAtingiu
      ? 0
      : monthsToReachGoal(patrimonioNecessario, patrimonioAtual, scenarioPmt, monthlyRate);
    const scenarioYears = scenarioMonths != null ? scenarioMonths / 12 : null;
    return { ...s, scenarioPmt, months: scenarioMonths, years: scenarioYears };
  });
  const baselineScenario = scenarios[0];

  function scenarioDelta(scenario: (typeof scenarios)[number]) {
    if (scenario.years == null) return null;
    if (baselineScenario.years == null) return "atinge a meta!";
    const diffYears = baselineScenario.years - scenario.years;
    if (diffYears < 0.05) return null;
    return diffYears < 1
      ? `antecipa ${Math.round(diffYears * 12)} m`
      : `antecipa ${diffYears.toFixed(1)} a`;
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Aposentadoria / FIRE</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {loading ? (
            <p className="text-center text-sm text-text-muted dark:text-text-muted-dark">Carregando...</p>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">Renda mensal desejada na aposentadoria</p>
                <MoneyInput
                  value={desiredIncome}
                  onChange={(v) => {
                    setDesiredIncome(v);
                    setSaved(false);
                  }}
                  className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">Taxa de retirada anual</p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={withdrawalRate}
                      onChange={(e) => {
                        setWithdrawalRate(e.target.value);
                        setSaved(false);
                      }}
                      className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 pr-7 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
                      %
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">Inflação anual esperada</p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inflationRate}
                      onChange={(e) => {
                        setInflationRate(e.target.value);
                        setSaved(false);
                      }}
                      className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 pr-7 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : saved ? "Plano salvo ✓" : "Salvar plano"}
              </button>
            </form>
          )}

          <div className="mt-5 rounded-card bg-forest px-4 py-3.5 text-center">
            <p className="text-xs text-sage-mint">Patrimônio necessário (valor de hoje)</p>
            <p className="mt-0.5 text-2xl font-medium text-white">
              {currency(patrimonioNecessario)}
            </p>
            <p className="mt-0.5 text-[10px] text-sage-mint">
              renda mensal × 12 ÷ taxa de retirada de {withdrawalRate || 0}%
            </p>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Patrimônio atual (longo prazo)</p>
              <p className="mt-1 text-base font-medium text-ink dark:text-sage">{currency(patrimonioAtual)}</p>
            </div>
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Quanto falta</p>
              <p
                className={`mt-1 text-base font-medium ${
                  jaAtingiu ? "text-forest dark:text-sage-mint" : "text-wine dark:text-wine-dark"
                }`}
              >
                {currency(faltam)}
              </p>
            </div>
          </div>

          <div className="mt-2.5 rounded-card bg-white px-3.5 py-3.5 text-center dark:bg-surface-dark">
            {jaAtingiu ? (
              <p className="text-sm font-medium text-forest dark:text-sage-mint">
                🎉 Você já tem patrimônio suficiente pra essa meta!
              </p>
            ) : monthsNeeded == null ? (
              <>
                <p className="text-sm font-medium text-wine dark:text-wine-dark">
                  Com o aporte e a taxa atuais, essa meta não é atingível.
                </p>
                <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                  Defina um aporte mensal no perfil de longo prazo do simulador de investimentos.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">Chega lá em aproximadamente</p>
                <p className="mt-0.5 text-xl font-medium text-ink dark:text-sage">
                  {yearsNeeded! < 1
                    ? `${Math.max(Math.ceil(monthsNeeded!), 1)} ${
                        Math.ceil(monthsNeeded!) === 1 ? "mês" : "meses"
                      }`
                    : `${Math.ceil(yearsNeeded!)} ${Math.ceil(yearsNeeded!) === 1 ? "ano" : "anos"}`}
                </p>
                <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                  considerando o aporte mensal ({currency(pmt)}) e a taxa de retorno (
                  {longoPrazo?.rate ?? 0}% a.a.) do seu perfil de longo prazo
                </p>
                {nominalAtGoal != null && (
                  <p className="mt-2 text-[11px] text-text-muted dark:text-text-muted-dark">
                    Em valores nominais nessa data, isso equivaleria a ≈{" "}
                    {currency(nominalAtGoal)}.
                  </p>
                )}
              </>
            )}
          </div>

          {!jaAtingiu && (
            <div className="mt-5">
              <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">E se eu aportasse mais por mês?</p>
              <MoneyInput
                value={extraContribution}
                onChange={setExtraContribution}
                className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
              />

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {scenarios.map((s, i) => {
                  const delta = i > 0 ? scenarioDelta(s) : null;
                  return (
                    <div
                      key={s.key}
                      className={`rounded-card px-2 py-3 text-center dark:bg-surface-dark ${
                        i === 0
                          ? "bg-white"
                          : "border border-forest bg-white dark:border-sage-mint/40"
                      }`}
                    >
                      <p className="text-[10px] text-text-muted dark:text-text-muted-dark">{s.label}</p>
                      <p className="mt-1 text-[11px] text-ink dark:text-sage">{currency(s.scenarioPmt)}/mês</p>
                      <p className="mt-2 text-sm font-medium text-ink dark:text-sage">
                        {s.years == null
                          ? "—"
                          : s.years < 1
                          ? `${Math.max(Math.ceil(s.months!), 1)} m`
                          : `${Math.ceil(s.years)} a`}
                      </p>
                      {delta && <p className="mt-1 text-[10px] text-forest dark:text-sage-mint">{delta}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(longoPrazo?.balance ?? 0) === 0 && (longoPrazo?.contribution ?? 0) === 0 && (
            <p className="mt-3 text-[11px] text-text-muted dark:text-text-muted-dark">
              Você ainda não configurou um perfil de longo prazo.{" "}
              <Link href="/investimentos" className="text-forest underline dark:text-sage-mint">
                Configurar no simulador de investimentos →
              </Link>
            </p>
          )}

          <p className="mt-3 text-[10px] text-text-muted dark:text-text-muted-dark">
            Projeção simplificada com taxas constantes — não considera impostos, mudanças de
            renda/gastos futuras ou variação de mercado, e não é recomendação de investimento ou
            consultoria financeira regulada.
          </p>

          <Link
            href="/metas"
            className="mt-3 block rounded-full border border-line-soft py-2.5 text-center text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
          >
            Definir metas de curto/médio prazo →
          </Link>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
