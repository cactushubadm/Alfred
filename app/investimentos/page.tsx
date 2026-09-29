"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { futureValue } from "@/lib/finance";

type ProfileType = "reserva" | "longo_prazo";
type Movement = { id: string; occurred_at: string; amount: number };

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function YearlyGrowthChart({ data }: { data: { year: number; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-card bg-white p-4 dark:bg-surface-dark">
      <p className="mb-3 text-xs text-text-muted dark:text-text-muted-dark">Evolução por ano</p>
      <div className="flex h-36 items-end gap-1">
        {data.map((d) => (
          <div
            key={d.year}
            className="flex h-full min-w-[6px] flex-1 flex-col items-center justify-end"
            title={`Ano ${d.year}: ${currency(d.value)}`}
          >
            <div
              className={`w-full rounded-t-sm ${
                d.year === data.length ? "bg-amber" : "bg-forest dark:bg-sage-mint"
              }`}
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d) => (
          <span
            key={d.year}
            className="min-w-[6px] flex-1 text-center text-[9px] text-text-muted dark:text-text-muted-dark"
          >
            {d.year % Math.max(Math.ceil(data.length / 8), 1) === 0 || d.year === data.length
              ? d.year
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InvestimentosPage() {
  const supabase = createClient();

  const [type, setType] = useState<ProfileType>("longo_prazo");

  // Perfil: longo prazo usa aporte mensal fixo; reserva usa só saldo
  // inicial (o aporte dela vem dos movimentos registrados, abaixo)
  const [currentBalance, setCurrentBalance] = useState("0.00");
  const [monthlyContribution, setMonthlyContribution] = useState("0.00");
  const [annualRate, setAnnualRate] = useState("8");
  const [years, setYears] = useState("10");
  // Sugestão de referência (meta de longo prazo do IPCA) — só simulação,
  // não é persistida no perfil
  const [inflationRate, setInflationRate] = useState("4.5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reserva: histórico real de quanto foi guardado/retirado — vários
  // registros por mês são permitidos, cada um com sua própria data
  const [historyMonth, setHistoryMonth] = useState(currentMonth);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [allMovementsSum, setAllMovementsSum] = useState(0);

  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementDate, setMovementDate] = useState(todayISO);
  const [movementDirection, setMovementDirection] = useState<"guardei" | "retirei">("guardei");
  const [movementAmount, setMovementAmount] = useState("0.00");
  const [savingMovement, setSavingMovement] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Movement | null>(null);
  const [deletingMovement, setDeletingMovement] = useState(false);

  // Saldo inicial da reserva, independente da aba ativa — precisa pro
  // aviso cruzado quando o usuário está simulando o longo prazo
  const [reservaInitialBalance, setReservaInitialBalance] = useState(0);
  // Gasto médio mensal real, do histórico de lançamentos — null se não há
  // histórico suficiente
  const [avgMonthlyExpense, setAvgMonthlyExpense] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setError(null);
    supabase
      .from("investment_profiles")
      .select("monthly_contribution, expected_annual_rate, current_balance")
      .eq("type", type)
      .maybeSingle()
      .then(({ data }) => {
        setCurrentBalance(data ? Number(data.current_balance).toFixed(2) : "0.00");
        setMonthlyContribution(data ? Number(data.monthly_contribution).toFixed(2) : "0.00");
        setAnnualRate(
          data ? String(Number(data.expected_annual_rate)) : type === "reserva" ? "10" : "8"
        );
        setLoading(false);
      });
  }, [type]);

  useEffect(() => {
    supabase
      .from("investment_profiles")
      .select("current_balance")
      .eq("type", "reserva")
      .maybeSingle()
      .then(({ data }) => setReservaInitialBalance(data ? Number(data.current_balance) : 0));
  }, []);

  async function loadAllMovementsSum() {
    const { data } = await supabase.from("reserve_movements").select("amount");
    setAllMovementsSum((data ?? []).reduce((sum, m) => sum + Number(m.amount), 0));
  }

  async function loadMovements(month: string) {
    setLoadingMovements(true);
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = new Date(y, m, 1).toISOString().slice(0, 10);

    const { data } = await supabase
      .from("reserve_movements")
      .select("id, occurred_at, amount")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at", { ascending: false });

    setMovements(data ?? []);
    setLoadingMovements(false);
  }

  useEffect(() => {
    loadAllMovementsSum();
  }, []);

  useEffect(() => {
    loadMovements(historyMonth);
  }, [historyMonth]);

  useEffect(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    supabase
      .from("transactions")
      .select("amount, occurred_at")
      .eq("type", "despesa")
      .gte("occurred_at", fromDate)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setAvgMonthlyExpense(null);
          return;
        }
        const byMonth = new Map<string, number>();
        data.forEach((t) => {
          const key = t.occurred_at.slice(0, 7);
          byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
        });
        const total = Array.from(byMonth.values()).reduce((sum, v) => sum + v, 0);
        setAvgMonthlyExpense(total / byMonth.size);
      });
  }, []);

  const reserveTarget = avgMonthlyExpense != null ? avgMonthlyExpense * 6 : null;
  const reservaTotal = reservaInitialBalance + allMovementsSum;

  function resetMovementForm() {
    setEditingMovementId(null);
    setMovementDate(todayISO());
    setMovementDirection("guardei");
    setMovementAmount("0.00");
  }

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

    const { error } = await supabase.from("investment_profiles").upsert(
      {
        user_id: user.id,
        type,
        current_balance: Number(currentBalance) || 0,
        monthly_contribution: type === "reserva" ? 0 : Number(monthlyContribution) || 0,
        expected_annual_rate: Number(annualRate.replace(",", ".")) || 0,
      },
      { onConflict: "user_id,type" }
    );

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (type === "reserva") {
      setReservaInitialBalance(Number(currentBalance) || 0);
    }
    setSaved(true);
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    setMovementError(null);
    setSavingMovement(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMovementError("Sessão expirada, faça login novamente.");
      setSavingMovement(false);
      return;
    }

    const signedAmount = (Number(movementAmount) || 0) * (movementDirection === "retirei" ? -1 : 1);

    const { error } = editingMovementId
      ? await supabase
          .from("reserve_movements")
          .update({ occurred_at: movementDate, amount: signedAmount })
          .eq("id", editingMovementId)
      : await supabase
          .from("reserve_movements")
          .insert({ user_id: user.id, occurred_at: movementDate, amount: signedAmount });

    setSavingMovement(false);
    if (error) {
      setMovementError(error.message);
      return;
    }
    resetMovementForm();
    setHistoryMonth(movementDate.slice(0, 7));
    loadAllMovementsSum();
    loadMovements(movementDate.slice(0, 7));
  }

  async function confirmDeleteMovement() {
    if (!pendingDelete) return;
    setDeletingMovement(true);
    const { error } = await supabase.from("reserve_movements").delete().eq("id", pendingDelete.id);
    setDeletingMovement(false);

    if (error) {
      setMovementError(error.message);
      return;
    }
    setPendingDelete(null);
    if (editingMovementId === pendingDelete.id) resetMovementForm();
    loadAllMovementsSum();
    loadMovements(historyMonth);
  }

  function startEditMovement(m: Movement) {
    setEditingMovementId(m.id);
    setMovementDate(m.occurred_at);
    setMovementDirection(Number(m.amount) < 0 ? "retirei" : "guardei");
    setMovementAmount(Math.abs(Number(m.amount)).toFixed(2));
  }

  const rateNum = Number(annualRate.replace(",", ".")) || 0;
  const monthlyRate = Math.pow(1 + rateNum / 100, 1 / 12) - 1;
  const yearsNum = Math.min(60, Math.max(1, Math.round(Number(years)) || 1));

  const presentValue = Number(currentBalance) || 0;
  const pmt = Number(monthlyContribution) || 0;

  const yearlyData = Array.from({ length: yearsNum }, (_, i) => {
    const y = i + 1;
    return { year: y, value: futureValue(presentValue, pmt, monthlyRate, y * 12) };
  });

  const finalValue = yearlyData[yearlyData.length - 1]?.value ?? presentValue;
  const totalContributed = presentValue + pmt * yearsNum * 12;
  const totalGrowth = finalValue - totalContributed;

  // VF_real = VF_nominal / (1 + inflação)^n — poder de compra de hoje
  const inflationNum = Number(inflationRate.replace(",", ".")) || 0;
  const realValue = finalValue / Math.pow(1 + inflationNum / 100, yearsNum);

  // Reserva: sem projeção de anos — só o rendimento simples estimado sobre
  // o saldo total guardado hoje, com taxa configurável (padrão 10% a.a.)
  const reservaAnnualYield = reservaTotal * (rateNum / 100);
  const reservaMonthlyYield = reservaAnnualYield / 12;

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Simulador de aportes</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("longo_prazo")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                type === "longo_prazo"
                  ? "bg-forest text-white"
                  : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
              }`}
            >
              Longo prazo
            </button>
            <button
              type="button"
              onClick={() => setType("reserva")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                type === "reserva"
                  ? "bg-forest text-white"
                  : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
              }`}
            >
              Reserva de emergência
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-center text-sm text-text-muted dark:text-text-muted-dark">Carregando...</p>
          ) : (
            <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">
                  {type === "reserva"
                    ? "Saldo inicial (opcional, antes de começar a registrar)"
                    : "Patrimônio atual"}
                </p>
                <MoneyInput
                  value={currentBalance}
                  onChange={(v) => {
                    setCurrentBalance(v);
                    setSaved(false);
                  }}
                  className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              </div>

              {type === "longo_prazo" && (
                <div>
                  <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">Aporte mensal</p>
                  <MoneyInput
                    value={monthlyContribution}
                    onChange={(v) => {
                      setMonthlyContribution(v);
                      setSaved(false);
                    }}
                    className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">
                    {type === "reserva"
                      ? "Rendimento estimado (configurável)"
                      : "Taxa de retorno anual esperada"}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={annualRate}
                      onChange={(e) => {
                        setAnnualRate(e.target.value);
                        setSaved(false);
                      }}
                      className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 pr-7 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
                      % a.a.
                    </span>
                  </div>
                </div>

                {type === "longo_prazo" && (
                  <div className="flex-1">
                    <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">Prazo</p>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={years}
                        onChange={(e) => setYears(e.target.value)}
                        className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 pr-14 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
                        anos
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {type === "longo_prazo" && (
                <div>
                  <p className="mb-1 text-xs text-text-muted dark:text-text-muted-dark">
                    Taxa de inflação anual esperada (sugestão: meta do IPCA)
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inflationRate}
                      onChange={(e) => setInflationRate(e.target.value)}
                      className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 pr-7 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted dark:text-text-muted-dark">
                      % a.a.
                    </span>
                  </div>
                </div>
              )}

              {reserveTarget != null && (
                <div
                  className={`rounded-card px-3.5 py-2.5 text-xs ${
                    type === "longo_prazo" && reservaTotal < reserveTarget
                      ? "border border-wine text-wine dark:border-wine-dark dark:text-wine-dark"
                      : "bg-white text-text-muted dark:bg-surface-dark dark:text-text-muted-dark"
                  }`}
                >
                  {type === "reserva" ? (
                    <>
                      Meta sugerida: 6 meses de gastos ≈ {currency(reserveTarget)} — você já tem{" "}
                      {currency(reservaTotal)} (
                      {Math.min(999, Math.round((reservaTotal / reserveTarget) * 100))}%)
                    </>
                  ) : reservaTotal < reserveTarget ? (
                    <>
                      ⚠ Sua reserva de emergência ainda está abaixo do recomendado (6 meses de
                      gastos ≈ {currency(reserveTarget)}; você tem {currency(reservaTotal)}{" "}
                      guardado). Considere priorizar a reserva antes de aumentar aportes de longo
                      prazo.
                    </>
                  ) : (
                    <>✓ Reserva de emergência dentro do recomendado ({currency(reservaTotal)}).</>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : saved ? "Perfil salvo ✓" : "Salvar perfil"}
              </button>
            </form>
          )}

          {type === "reserva" && (
            <div className="mt-5">
              <p className="mb-2 text-xs text-text-muted dark:text-text-muted-dark">
                {editingMovementId ? "Editar registro" : "Registrar guardou/retirou"}
              </p>
              <form
                onSubmit={handleSaveMovement}
                className="flex flex-col gap-2 rounded-card bg-white p-3.5 dark:bg-surface-dark"
              >
                <input
                  type="date"
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementDirection("guardei")}
                    className={`flex-1 rounded-full py-2 text-xs font-medium ${
                      movementDirection === "guardei"
                        ? "bg-forest text-white"
                        : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                    }`}
                  >
                    Guardei
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementDirection("retirei")}
                    className={`flex-1 rounded-full py-2 text-xs font-medium ${
                      movementDirection === "retirei"
                        ? "bg-wine text-white"
                        : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                    }`}
                  >
                    Retirei
                  </button>
                </div>
                <MoneyInput
                  value={movementAmount}
                  onChange={setMovementAmount}
                  className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
                {movementError && <p className="text-sm text-wine dark:text-wine-dark">{movementError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingMovement}
                    className="flex-1 rounded-full bg-forest py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {savingMovement ? "Salvando..." : editingMovementId ? "Salvar edição" : "Adicionar"}
                  </button>
                  {editingMovementId && (
                    <button
                      type="button"
                      onClick={resetMovementForm}
                      className="flex-1 rounded-full border border-line-soft py-2.5 text-sm font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-text-muted dark:text-text-muted-dark">Histórico</p>
                <input
                  type="month"
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="rounded-card border border-line-soft bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {loadingMovements ? (
                  <p className="text-center text-sm text-text-muted dark:text-text-muted-dark">Carregando...</p>
                ) : movements.length === 0 ? (
                  <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                    Nenhum registro neste mês.
                  </p>
                ) : (
                  movements.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark"
                    >
                      <p className="text-sm text-ink dark:text-sage">{dateLabel(m.occurred_at)}</p>
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium ${
                            Number(m.amount) >= 0
                              ? "text-forest dark:text-sage-mint"
                              : "text-wine dark:text-wine-dark"
                          }`}
                        >
                          {Number(m.amount) >= 0 ? "+" : "-"}
                          {currency(Math.abs(Number(m.amount)))}
                        </p>
                        <button
                          type="button"
                          onClick={() => startEditMovement(m)}
                          className="rounded-full border border-line-soft px-2.5 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(m)}
                          className="rounded-full border border-wine px-2.5 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {type === "longo_prazo" ? (
            <>
              <div className="mt-5 rounded-card bg-forest px-4 py-3.5">
                <p className="text-center text-xs text-sage-mint">
                  Patrimônio projetado em {yearsNum} {yearsNum === 1 ? "ano" : "anos"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-lg font-medium text-white">{currency(finalValue)}</p>
                    <p className="text-[10px] text-sage-mint">valor nominal</p>
                  </div>
                  <div className="border-l border-white/15">
                    <p className="text-lg font-medium text-amber">{currency(realValue)}</p>
                    <p className="text-[10px] text-sage-mint">valor real (poder de compra hoje)</p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Total aportado</p>
                  <p className="mt-1 text-base font-medium text-ink dark:text-sage">{currency(totalContributed)}</p>
                </div>
                <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">Rendimento</p>
                  <p className="mt-1 text-base font-medium text-forest dark:text-sage-mint">{currency(totalGrowth)}</p>
                </div>
              </div>

              <div className="mt-2.5">
                <YearlyGrowthChart data={yearlyData} />
              </div>

              <p className="mt-3 text-[10px] text-text-muted dark:text-text-muted-dark">
                Projeção simplificada com taxas constantes — o valor real desconta a inflação
                informada acima (poder de compra de hoje); não considera impostos ou variação de
                mercado, e não é recomendação de investimento.
              </p>
            </>
          ) : (
            <>
              <div className="mt-5 rounded-card bg-forest px-4 py-3.5 text-center">
                <p className="text-xs text-sage-mint">Reserva total guardada</p>
                <p className="mt-0.5 text-2xl font-medium text-white">{currency(reservaTotal)}</p>
              </div>

              <div className="mt-2.5 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                <p className="text-xs text-text-muted dark:text-text-muted-dark">
                  Rendimento estimado a {annualRate || 0}% a.a.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark">Por ano</p>
                    <p className="text-base font-medium text-forest dark:text-sage-mint">
                      {currency(reservaAnnualYield)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark">Por mês</p>
                    <p className="text-base font-medium text-forest dark:text-sage-mint">
                      {currency(reservaMonthlyYield)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[10px] text-text-muted dark:text-text-muted-dark">
                Estimativa simples sobre o saldo atual (sem considerar novos aportes/retiradas
                futuras) — não é recomendação de investimento.
              </p>
            </>
          )}

          <Link
            href="/aposentadoria"
            className="mt-3 block rounded-full border border-line-soft py-2.5 text-center text-xs font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
          >
            Calcular aposentadoria / FIRE →
          </Link>
        </div>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir registro"
        message={
          pendingDelete
            ? `Tem certeza que quer excluir o registro de ${dateLabel(pendingDelete.occurred_at)} (${
                Number(pendingDelete.amount) >= 0 ? "+" : "-"
              }${currency(Math.abs(Number(pendingDelete.amount)))})? Essa ação não pode ser desfeita.`
            : ""
        }
        loading={deletingMovement}
        onConfirm={confirmDeleteMovement}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
