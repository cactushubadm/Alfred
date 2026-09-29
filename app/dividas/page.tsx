"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton } from "@/components/motion/Pressable";

type DebtType = "cartao" | "emprestimo" | "financiamento" | "cheque_especial";

type Debt = {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  monthly_interest_rate: number;
  monthly_payment: number;
  remaining_installments: number | null;
};

const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: "cartao", label: "Cartão de crédito" },
  { value: "emprestimo", label: "Empréstimo" },
  { value: "financiamento", label: "Financiamento" },
  { value: "cheque_especial", label: "Cheque especial" },
];

function debtTypeLabel(type: string) {
  return DEBT_TYPES.find((t) => t.value === type)?.label ?? type;
}

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function monthsLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} ${rest === 1 ? "mês" : "meses"}`;
  if (rest === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}

const MAX_MONTHS = 600; // 50 anos — teto de segurança pra estratégias que não convergem

type SimDebt = { id: string; balance: number; monthlyRate: number; minPayment: number };

function simulateStrategy(
  debts: SimDebt[],
  extraMonthly: number,
  strategy: "avalanche" | "bola_de_neve"
) {
  const order = [...debts].sort((a, b) =>
    strategy === "avalanche" ? b.monthlyRate - a.monthlyRate : a.balance - b.balance
  );

  const state = order.map((d) => ({ ...d, remaining: d.balance, paidOff: false }));
  let totalInterest = 0;
  let freedPool = 0;
  let month = 0;

  while (state.some((d) => d.remaining > 0.005) && month < MAX_MONTHS) {
    month++;

    state.forEach((d) => {
      if (d.remaining <= 0) return;
      const interest = d.remaining * d.monthlyRate;
      totalInterest += interest;
      d.remaining += interest;
    });

    const target = state.find((d) => d.remaining > 0);

    state.forEach((d) => {
      if (d.remaining <= 0) return;
      if (d === target) {
        d.remaining = Math.max(d.remaining - (d.minPayment + extraMonthly + freedPool), 0);
      } else {
        d.remaining = Math.max(d.remaining - Math.min(d.minPayment, d.remaining), 0);
      }
      if (d.remaining <= 0) d.paidOff = true;
    });

    freedPool = state.filter((d) => d.paidOff).reduce((sum, d) => sum + d.minPayment, 0);
  }

  return { months: month, totalInterest, converged: month < MAX_MONTHS };
}

function DebtForm({
  name,
  setName,
  type,
  setType,
  balance,
  setBalance,
  monthlyInterestRate,
  setMonthlyInterestRate,
  monthlyPayment,
  setMonthlyPayment,
  remainingInstallments,
  setRemainingInstallments,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  name: string;
  setName: (v: string) => void;
  type: DebtType;
  setType: (v: DebtType) => void;
  balance: string;
  setBalance: (v: string) => void;
  monthlyInterestRate: string;
  setMonthlyInterestRate: (v: string) => void;
  monthlyPayment: string;
  setMonthlyPayment: (v: string) => void;
  remainingInstallments: string;
  setRemainingInstallments: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-card bg-white p-3.5 dark:bg-surface-dark">
      <input
        type="text"
        placeholder="Nome da dívida"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as DebtType)}
        className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
      >
        {DEBT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Saldo devedor</p>
        <MoneyInput
          value={balance}
          onChange={setBalance}
          className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Juros ao mês (%)</p>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={monthlyInterestRate}
            onChange={(e) => setMonthlyInterestRate(e.target.value)}
            className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Parcelas restantes</p>
          <input
            type="number"
            min="0"
            placeholder="opcional"
            value={remainingInstallments}
            onChange={(e) => setRemainingInstallments(e.target.value)}
            className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Parcela / pagamento mínimo mensal</p>
        <MoneyInput
          value={monthlyPayment}
          onChange={setMonthlyPayment}
          className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
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
function DividasPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<DebtType>("cartao");
  const [editBalance, setEditBalance] = useState("0.00");
  const [editRate, setEditRate] = useState("0");
  const [editPayment, setEditPayment] = useState("0.00");
  const [editRemaining, setEditRemaining] = useState("");

  const [showNewForm, setShowNewForm] = useState(() => searchParams.get("new") === "1");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DebtType>("cartao");
  const [newBalance, setNewBalance] = useState("0.00");
  const [newRate, setNewRate] = useState("0");
  const [newPayment, setNewPayment] = useState("0.00");
  const [newRemaining, setNewRemaining] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [extraMonthly, setExtraMonthly] = useState("0.00");

  async function loadDebts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("debts")
      .select(
        "id, name, type, balance, monthly_interest_rate, monthly_payment, remaining_installments"
      )
      .order("created_at");

    if (error) {
      setError(error.message);
    } else {
      setDebts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadDebts();
  }, []);

  function startEdit(debt: Debt) {
    setEditingId(debt.id);
    setEditName(debt.name);
    setEditType(debt.type);
    setEditBalance(Number(debt.balance).toFixed(2));
    setEditRate(String(debt.monthly_interest_rate));
    setEditPayment(Number(debt.monthly_payment).toFixed(2));
    setEditRemaining(
      debt.remaining_installments != null ? String(debt.remaining_installments) : ""
    );
    setShowNewForm(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setSaving(true);

    const { error } = await supabase
      .from("debts")
      .update({
        name: editName,
        type: editType,
        balance: Number(editBalance) || 0,
        monthly_interest_rate: Number(editRate) || 0,
        monthly_payment: Number(editPayment) || 0,
        remaining_installments: editRemaining ? parseInt(editRemaining, 10) : null,
      })
      .eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    loadDebts();
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
    const { error } = await supabase.from("debts").insert({
      user_id: user.id,
      name: newName,
      type: newType,
      balance: Number(newBalance) || 0,
      monthly_interest_rate: Number(newRate) || 0,
      monthly_payment: Number(newPayment) || 0,
      remaining_installments: newRemaining ? parseInt(newRemaining, 10) : null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewType("cartao");
    setNewBalance("0.00");
    setNewRate("0");
    setNewPayment("0.00");
    setNewRemaining("");
    setShowNewForm(false);
    loadDebts();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("debts").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPendingDelete(null);
    loadDebts();
  }

  const extraNum = Number(extraMonthly) || 0;

  const simInput: SimDebt[] = useMemo(
    () =>
      debts
        .filter((d) => Number(d.balance) > 0)
        .map((d) => ({
          id: d.id,
          balance: Number(d.balance),
          monthlyRate: Number(d.monthly_interest_rate) / 100,
          minPayment: Number(d.monthly_payment),
        })),
    [debts]
  );

  const avalanche = useMemo(
    () => (simInput.length > 0 ? simulateStrategy(simInput, extraNum, "avalanche") : null),
    [simInput, extraNum]
  );
  const bolaDeNeve = useMemo(
    () => (simInput.length > 0 ? simulateStrategy(simInput, extraNum, "bola_de_neve") : null),
    [simInput, extraNum]
  );

  const fasterStrategy =
    avalanche && bolaDeNeve
      ? avalanche.months === bolaDeNeve.months
        ? null
        : avalanche.months < bolaDeNeve.months
        ? "avalanche"
        : "bola_de_neve"
      : null;

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Dívidas</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {error && <p className="mb-3 text-sm text-wine dark:text-wine-dark">{error}</p>}

          {loading ? (
            <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Carregando...
            </p>
          ) : debts.length === 0 ? (
            <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Nenhuma dívida cadastrada ainda.
            </p>
          ) : (
            <StaggerList className="flex flex-col gap-2.5">
              {debts.map((debt) => {
                if (editingId === debt.id) {
                  return (
                    <StaggerItem key={debt.id}>
                      <DebtForm
                        name={editName}
                        setName={setEditName}
                        type={editType}
                        setType={setEditType}
                        balance={editBalance}
                        setBalance={setEditBalance}
                        monthlyInterestRate={editRate}
                        setMonthlyInterestRate={setEditRate}
                        monthlyPayment={editPayment}
                        setMonthlyPayment={setEditPayment}
                        remainingInstallments={editRemaining}
                        setRemainingInstallments={setEditRemaining}
                        onSubmit={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                        submitLabel="Salvar"
                      />
                    </StaggerItem>
                  );
                }

                return (
                  <StaggerItem key={debt.id} className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-ink dark:text-sage">{debt.name}</p>
                        <p className="text-[11px] text-text-muted dark:text-text-muted-dark">{debtTypeLabel(debt.type)}</p>
                      </div>
                      <div className="flex gap-2">
                        <PressableButton
                          type="button"
                          onClick={() => startEdit(debt)}
                          className="rounded-full border border-line-soft px-2.5 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                        >
                          Editar
                        </PressableButton>
                        <PressableButton
                          type="button"
                          onClick={() => setPendingDelete(debt)}
                          className="rounded-full border border-wine px-2.5 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                        >
                          Excluir
                        </PressableButton>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-wine dark:text-wine-dark">{currency(Number(debt.balance))}</p>
                      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                        {Number(debt.monthly_interest_rate).toLocaleString("pt-BR")}% a.m. ·{" "}
                        {currency(Number(debt.monthly_payment))}/mês
                        {debt.remaining_installments != null
                          ? ` · ${debt.remaining_installments}x restantes`
                          : ""}
                      </p>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}

          <div className="mt-4">
            {showNewForm ? (
              <DebtForm
                name={newName}
                setName={setNewName}
                type={newType}
                setType={setNewType}
                balance={newBalance}
                setBalance={setNewBalance}
                monthlyInterestRate={newRate}
                setMonthlyInterestRate={setNewRate}
                monthlyPayment={newPayment}
                setMonthlyPayment={setNewPayment}
                remainingInstallments={newRemaining}
                setRemainingInstallments={setNewRemaining}
                onSubmit={handleCreate}
                onCancel={() => setShowNewForm(false)}
                saving={saving}
                submitLabel="Adicionar dívida"
              />
            ) : (
              <PressableButton
                type="button"
                onClick={() => {
                  setShowNewForm(true);
                  setEditingId(null);
                }}
                className="block w-full rounded-full border border-forest py-3 text-center text-sm font-medium text-forest dark:border-text-muted-dark/30 dark:text-sage-mint"
              >
                + Nova dívida
              </PressableButton>
            )}
          </div>

          {simInput.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-ink dark:text-sage">Simulador de quitação</p>
              <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                Compara avalanche (maior juros primeiro) vs. bola de neve (menor saldo
                primeiro), considerando um valor extra por mês além das parcelas mínimas.
              </p>

              <div className="mt-3">
                <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Extra por mês para acelerar</p>
                <MoneyInput
                  value={extraMonthly}
                  onChange={setExtraMonthly}
                  className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              </div>

              <StaggerList className="mt-3 flex flex-col gap-2.5">
                {(
                  [
                    { key: "avalanche" as const, label: "Avalanche", result: avalanche },
                    { key: "bola_de_neve" as const, label: "Bola de neve", result: bolaDeNeve },
                  ]
                ).map((s) => (
                  <StaggerItem
                    key={s.key}
                    className={`rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark ${
                      fasterStrategy === s.key ? "border border-forest dark:border-sage-mint/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink dark:text-sage">{s.label}</p>
                      {fasterStrategy === s.key && (
                        <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-medium text-white">
                          Mais rápida
                        </span>
                      )}
                    </div>
                    {s.result && s.result.converged ? (
                      <>
                        <p className="mt-1.5 text-xs text-text-muted dark:text-text-muted-dark">
                          Tempo até quitar tudo:{" "}
                          <span className="font-medium text-ink dark:text-sage">
                            {monthsLabel(s.result.months)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted dark:text-text-muted-dark">
                          Total de juros pago:{" "}
                          <span className="font-medium text-wine dark:text-wine-dark">
                            {currency(s.result.totalInterest)}
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="mt-1.5 text-xs text-wine dark:text-wine-dark">
                        Com esses valores a dívida não é quitada em 50 anos — aumente o valor
                        extra ou as parcelas mínimas.
                      </p>
                    )}
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir dívida"
        message={`Tem certeza que quer excluir "${pendingDelete?.name}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}

export default function DividasPage() {
  return (
    <Suspense fallback={null}>
      <DividasPageInner />
    </Suspense>
  );
}
