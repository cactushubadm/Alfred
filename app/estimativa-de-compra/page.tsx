"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  futureValue,
  annualToMonthlyRate,
  amortizationPayment,
  goalMonthlyRequirement,
} from "@/lib/finance";
import { projectCashFlow } from "@/lib/cashFlow";
import { getReserveStatus } from "@/lib/reserve";

type PurchaseIntent = {
  id: string;
  name: string;
  cash_price: number;
  installment_count: number;
  has_interest: boolean;
  interest_rate: number | null;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function monthsFromNowLabel(months: number) {
  const d = new Date();
  d.setDate(1); // evita "pular" um mês em dias 29-31 ao somar meses
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

type Planning = {
  monthlyCashFlow: number; // média mensal do fluxo de caixa projetado (Wave 3)
  goalsPerMonth: number; // soma do que as metas ativas já exigem por mês
  freeSurplus: number; // o que sobra pra essa compra sem atrasar metas
  reserveTotal: number;
  reserveTarget: number | null;
};

function PurchaseForm({
  name,
  setName,
  cashPrice,
  setCashPrice,
  installmentCount,
  setInstallmentCount,
  hasInterest,
  setHasInterest,
  interestRate,
  setInterestRate,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  name: string;
  setName: (v: string) => void;
  cashPrice: string;
  setCashPrice: (v: string) => void;
  installmentCount: string;
  setInstallmentCount: (v: string) => void;
  hasInterest: boolean;
  setHasInterest: (v: boolean) => void;
  interestRate: string;
  setInterestRate: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 rounded-card bg-white p-3.5 dark:bg-surface-dark"
    >
      <input
        type="text"
        placeholder="O que você quer comprar?"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-card border border-line-soft px-3 py-2 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
      />
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Valor à vista</p>
        <MoneyInput
          value={cashPrice}
          onChange={setCashPrice}
          className="w-full rounded-card border border-line-soft px-3 py-2 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">
          Em quantas parcelas?
        </p>
        <input
          type="number"
          min="2"
          max="48"
          required
          value={installmentCount}
          onChange={(e) => setInstallmentCount(e.target.value)}
          className="w-full rounded-card border border-line-soft px-3 py-2 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
      <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
        Parcelamento tem juros embutidos?
        <ToggleSwitch checked={hasInterest} onChange={setHasInterest} />
      </div>
      {hasInterest && (
        <div>
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">
            Juros do parcelamento (% ao mês)
          </p>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="w-full rounded-card border border-line-soft px-3 py-2 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-forest py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-line-soft py-2.5 text-sm font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// useSearchParams() exige um limite de Suspense (pro build estático não
// quebrar) — só o "new=1" do "+" da barra inferior depende dele, então o
// fallback nunca aparece de verdade na prática.
function EstimativaDeCompraPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [intents, setIntents] = useState<PurchaseIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [investAnnualRate, setInvestAnnualRate] = useState<number | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCashPrice, setEditCashPrice] = useState("0.00");
  const [editInstallmentCount, setEditInstallmentCount] = useState("2");
  const [editHasInterest, setEditHasInterest] = useState(false);
  const [editInterestRate, setEditInterestRate] = useState("0");

  const [showNewForm, setShowNewForm] = useState(() => searchParams.get("new") === "1");
  const [newName, setNewName] = useState("");
  const [newCashPrice, setNewCashPrice] = useState("0.00");
  const [newInstallmentCount, setNewInstallmentCount] = useState("2");
  const [newHasInterest, setNewHasInterest] = useState(false);
  const [newInterestRate, setNewInterestRate] = useState("0");

  const [pendingDelete, setPendingDelete] = useState<PurchaseIntent | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadIntents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchase_intents")
      .select("id, name, cash_price, installment_count, has_interest, interest_rate")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setIntents(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadIntents();
    supabase
      .from("investment_profiles")
      .select("expected_annual_rate")
      .eq("type", "longo_prazo")
      .maybeSingle()
      .then(({ data }) => setInvestAnnualRate(data ? Number(data.expected_annual_rate) : null));
  }, []);

  // "Melhor época pra comprar": fluxo de caixa projetado (Wave 3) menos o
  // que as metas ativas (goals) já exigem por mês — nunca considera o saldo
  // guardado na reserva de emergência como fonte pra essa compra, então a
  // reserva nunca é comprometida pelo cálculo.
  useEffect(() => {
    async function loadPlanning() {
      const items = await projectCashFlow(supabase, 90);
      const entradas = items.filter((i) => i.type === "receita").reduce((s, i) => s + i.amount, 0);
      const saidas = items.filter((i) => i.type === "despesa").reduce((s, i) => s + i.amount, 0);
      const monthlyCashFlow = (entradas - saidas) / 3;

      const { data: goals } = await supabase
        .from("goals")
        .select("target_amount, current_amount, target_date");
      const goalsPerMonth = (goals ?? []).reduce(
        (sum, g) =>
          sum +
          goalMonthlyRequirement(Number(g.target_amount), Number(g.current_amount), g.target_date),
        0
      );

      const reserveStatus = await getReserveStatus(supabase);

      setPlanning({
        monthlyCashFlow,
        goalsPerMonth,
        freeSurplus: monthlyCashFlow - goalsPerMonth,
        reserveTotal: reserveStatus.total,
        reserveTarget: reserveStatus.target,
      });
    }

    loadPlanning();
  }, []);

  function startEdit(intent: PurchaseIntent) {
    setEditingId(intent.id);
    setEditName(intent.name);
    setEditCashPrice(Number(intent.cash_price).toFixed(2));
    setEditInstallmentCount(String(intent.installment_count));
    setEditHasInterest(intent.has_interest);
    setEditInterestRate(intent.interest_rate != null ? String(intent.interest_rate) : "0");
    setShowNewForm(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setSaving(true);

    const { error } = await supabase
      .from("purchase_intents")
      .update({
        name: editName,
        cash_price: Number(editCashPrice) || 0,
        installment_count: parseInt(editInstallmentCount, 10) || 2,
        has_interest: editHasInterest,
        interest_rate: editHasInterest ? Number(editInterestRate) || 0 : null,
      })
      .eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    loadIntents();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login novamente.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("purchase_intents").insert({
      user_id: user.id,
      name: newName,
      cash_price: Number(newCashPrice) || 0,
      installment_count: parseInt(newInstallmentCount, 10) || 2,
      has_interest: newHasInterest,
      interest_rate: newHasInterest ? Number(newInterestRate) || 0 : null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewCashPrice("0.00");
    setNewInstallmentCount("2");
    setNewHasInterest(false);
    setNewInterestRate("0");
    setShowNewForm(false);
    loadIntents();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("purchase_intents").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPendingDelete(null);
    loadIntents();
  }

  // Compara parcelar (investindo o valor à vista e usando-o pra pagar cada
  // parcela conforme vence) vs. pagar à vista, reaproveitando a mesma
  // fórmula de juros compostos com aportes do simulador de investimentos
  // (aqui com PMT negativo = retirada mensal pra cobrir a parcela).
  function evaluateIntent(intent: PurchaseIntent) {
    const n = intent.installment_count;
    const installmentRate = intent.has_interest ? (intent.interest_rate ?? 0) / 100 : 0;
    const installmentValue = amortizationPayment(Number(intent.cash_price), installmentRate, n);

    if (investAnnualRate == null) {
      return { installmentValue, result: null as number | null };
    }

    const investMonthlyRate = annualToMonthlyRate(investAnnualRate);
    const result = futureValue(Number(intent.cash_price), -installmentValue, investMonthlyRate, n);

    return { installmentValue, result, installmentRate, investMonthlyRate };
  }

  // Em quantos meses dá pra fazer essa compra sem atrasar as metas ativas
  // nem mexer na reserva — usa só a sobra livre do fluxo de caixa projetado.
  function estimateTiming(intent: PurchaseIntent, installmentValue: number) {
    if (!planning) return null;
    const { freeSurplus } = planning;

    const monthsToVista =
      freeSurplus > 0.01 ? Math.ceil(Number(intent.cash_price) / freeSurplus) : null;
    const canStartParceling = freeSurplus >= installmentValue;

    return { monthsToVista, canStartParceling, freeSurplus };
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Estimativa de compra</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {error && <p className="mb-3 text-sm text-wine dark:text-wine-dark">{error}</p>}

          {investAnnualRate == null && (
            <p className="mb-3 text-[11px] text-text-muted dark:text-text-muted-dark">
              Você ainda não configurou um perfil de investimento de longo prazo — sem ele não dá
              pra comparar as opções.{" "}
              <Link href="/investimentos" className="text-forest underline dark:text-sage-mint">
                Configurar no simulador de investimentos →
              </Link>
            </p>
          )}

          {planning && (
            <div className="mb-3 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                Sobra livre por mês pra novas compras
              </p>
              <p
                className={`mt-1 text-lg font-medium ${
                  planning.freeSurplus >= 0
                    ? "text-forest dark:text-sage-mint"
                    : "text-wine dark:text-wine-dark"
                }`}
              >
                {currency(planning.freeSurplus)}
              </p>
              <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                Fluxo de caixa projetado ({currency(planning.monthlyCashFlow)}/mês) menos o que
                suas metas ativas já exigem ({currency(planning.goalsPerMonth)}/mês) — a reserva de
                emergência nunca entra nessa conta.
              </p>
              {planning.reserveTarget != null && planning.reserveTotal < planning.reserveTarget && (
                <p className="mt-2 text-[11px] text-amber">
                  Sua reserva de emergência ainda não atingiu a meta mínima (
                  {currency(planning.reserveTotal)} de {currency(planning.reserveTarget)}) — o
                  cálculo acima já não usa esse dinheiro, mas vale considerar priorizá-la antes
                  dessa compra.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Carregando...
              </p>
            ) : intents.length === 0 ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Nenhuma intenção de compra cadastrada ainda.
              </p>
            ) : (
              intents.map((intent) => {
                if (editingId === intent.id) {
                  return (
                    <PurchaseForm
                      key={intent.id}
                      name={editName}
                      setName={setEditName}
                      cashPrice={editCashPrice}
                      setCashPrice={setEditCashPrice}
                      installmentCount={editInstallmentCount}
                      setInstallmentCount={setEditInstallmentCount}
                      hasInterest={editHasInterest}
                      setHasInterest={setEditHasInterest}
                      interestRate={editInterestRate}
                      setInterestRate={setEditInterestRate}
                      onSubmit={handleUpdate}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                      submitLabel="Salvar"
                    />
                  );
                }

                const evalResult = evaluateIntent(intent);
                const annualEffective =
                  evalResult.installmentRate != null
                    ? (Math.pow(1 + evalResult.installmentRate, 12) - 1) * 100
                    : 0;
                const timing = estimateTiming(intent, evalResult.installmentValue);

                return (
                  <div
                    key={intent.id}
                    className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink dark:text-sage">{intent.name}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(intent)}
                          className="rounded-full border border-line-soft px-2.5 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(intent)}
                          className="rounded-full border border-wine px-2.5 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                      {currency(Number(intent.cash_price))} à vista · {intent.installment_count}x
                      de {currency(evalResult.installmentValue)}
                      {intent.has_interest
                        ? ` (${Number(intent.interest_rate).toLocaleString("pt-BR")}% a.m. · ${annualEffective.toFixed(1)}% a.a.)`
                        : " (sem juros)"}
                    </p>

                    {investAnnualRate != null && evalResult.result != null && (
                      <div
                        className={`mt-2 rounded-card px-3 py-2 text-xs ${
                          evalResult.result >= 0
                            ? "bg-forest-light text-forest"
                            : "border border-wine text-wine dark:border-wine-dark dark:text-wine-dark"
                        }`}
                      >
                        {evalResult.result >= 0 ? (
                          <>
                            Parcelar e investir a diferença (a {investAnnualRate.toLocaleString("pt-BR")}%
                            a.a.) renderia <strong>{currency(evalResult.result)}</strong> a mais do
                            que pagar à vista.
                          </>
                        ) : (
                          <>
                            Pagar à vista evita <strong>{currency(-evalResult.result)}</strong> de
                            juros em relação a parcelar.
                          </>
                        )}
                      </div>
                    )}

                    {timing && (
                      <div className="mt-2 rounded-card border border-line-soft px-3 py-2 text-xs text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark">
                        <p className="text-[11px] font-medium text-ink dark:text-sage">
                          Melhor época pra comprar
                        </p>
                        {timing.monthsToVista == null ? (
                          <p className="mt-0.5">
                            Com o fluxo de caixa e as metas atuais, ainda não sobra dinheiro pra
                            essa compra à vista.
                          </p>
                        ) : timing.monthsToVista === 0 ? (
                          <p className="mt-0.5">Já dá pra comprar à vista agora, sem atrasar suas metas.</p>
                        ) : (
                          <p className="mt-0.5">
                            À vista: em <strong>{timing.monthsToVista}</strong>{" "}
                            {timing.monthsToVista === 1 ? "mês" : "meses"} (por volta de{" "}
                            {monthsFromNowLabel(timing.monthsToVista)}).
                          </p>
                        )}
                        <p className="mt-0.5">
                          Parcelado: a parcela de {currency(evalResult.installmentValue)}{" "}
                          {timing.canStartParceling
                            ? "já cabe na sua sobra mensal — pode começar agora."
                            : "ainda não cabe na sua sobra mensal projetada."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4">
            {showNewForm ? (
              <PurchaseForm
                name={newName}
                setName={setNewName}
                cashPrice={newCashPrice}
                setCashPrice={setNewCashPrice}
                installmentCount={newInstallmentCount}
                setInstallmentCount={setNewInstallmentCount}
                hasInterest={newHasInterest}
                setHasInterest={setNewHasInterest}
                interestRate={newInterestRate}
                setInterestRate={setNewInterestRate}
                onSubmit={handleCreate}
                onCancel={() => setShowNewForm(false)}
                saving={saving}
                submitLabel="Comparar"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(true);
                  setEditingId(null);
                }}
                className="block w-full rounded-full border border-forest py-3 text-center text-sm font-medium text-forest dark:border-sage-mint/40 dark:text-sage-mint"
              >
                + Nova intenção de compra
              </button>
            )}
          </div>

          <p className="mt-4 text-[10px] text-text-muted dark:text-text-muted-dark">
            Simulação simplificada: assume que o valor à vista fica investido e é usado pra pagar
            cada parcela conforme vence, à taxa de retorno esperada do seu perfil de longo prazo —
            não considera impostos, IOF ou variação de mercado, e não é recomendação financeira.
          </p>
        </div>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir intenção de compra"
        message={`Tem certeza que quer excluir "${pendingDelete?.name}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}

export default function EstimativaDeCompraPage() {
  return (
    <Suspense fallback={null}>
      <EstimativaDeCompraPageInner />
    </Suspense>
  );
}
