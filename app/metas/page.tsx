"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton } from "@/components/motion/Pressable";

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string;
  current_amount: number;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

// Meses inteiros entre hoje e a data-alvo (pode ser <= 0 se já passou)
function monthsRemaining(targetDateStr: string) {
  const today = new Date();
  const [y, m, d] = targetDateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function GoalForm({
  name,
  setName,
  targetAmount,
  setTargetAmount,
  currentAmount,
  setCurrentAmount,
  targetDate,
  setTargetDate,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  name: string;
  setName: (v: string) => void;
  targetAmount: string;
  setTargetAmount: (v: string) => void;
  currentAmount: string;
  setCurrentAmount: (v: string) => void;
  targetDate: string;
  setTargetDate: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-card bg-white p-3.5 dark:bg-surface-dark">
      <input
        type="text"
        placeholder="Nome da meta"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
      />
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Valor alvo</p>
        <MoneyInput
          value={targetAmount}
          onChange={setTargetAmount}
          className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Já tenho guardado (opcional)</p>
        <MoneyInput
          value={currentAmount}
          onChange={setCurrentAmount}
          className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Data alvo</p>
        <input
          type="date"
          required
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
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
function MetasPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTargetAmount, setEditTargetAmount] = useState("0.00");
  const [editCurrentAmount, setEditCurrentAmount] = useState("0.00");
  const [editTargetDate, setEditTargetDate] = useState(todayISO);

  const [showNewForm, setShowNewForm] = useState(() => searchParams.get("new") === "1");
  const [newName, setNewName] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("0.00");
  const [newCurrentAmount, setNewCurrentAmount] = useState("0.00");
  const [newTargetDate, setNewTargetDate] = useState(todayISO);

  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadGoals() {
    setLoading(true);
    const { data, error } = await supabase
      .from("goals")
      .select("id, name, target_amount, target_date, current_amount")
      .order("target_date");

    if (error) {
      setError(error.message);
    } else {
      setGoals(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGoals();
  }, []);

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditName(goal.name);
    setEditTargetAmount(Number(goal.target_amount).toFixed(2));
    setEditCurrentAmount(Number(goal.current_amount).toFixed(2));
    setEditTargetDate(goal.target_date);
    setShowNewForm(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setSaving(true);

    const { error } = await supabase
      .from("goals")
      .update({
        name: editName,
        target_amount: Number(editTargetAmount) || 0,
        current_amount: Number(editCurrentAmount) || 0,
        target_date: editTargetDate,
      })
      .eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    loadGoals();
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
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      name: newName,
      target_amount: Number(newTargetAmount) || 0,
      current_amount: Number(newCurrentAmount) || 0,
      target_date: newTargetDate,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewTargetAmount("0.00");
    setNewCurrentAmount("0.00");
    setNewTargetDate(todayISO());
    setShowNewForm(false);
    loadGoals();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("goals").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPendingDelete(null);
    loadGoals();
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Metas</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {error && <p className="mb-3 text-sm text-wine dark:text-wine-dark">{error}</p>}

          {loading ? (
            <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Carregando...
            </p>
          ) : goals.length === 0 ? (
            <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Nenhuma meta ainda.
            </p>
          ) : (
            <StaggerList className="flex flex-col gap-2.5">
              {goals.map((goal) => {
                if (editingId === goal.id) {
                  return (
                    <StaggerItem key={goal.id}>
                      <GoalForm
                        name={editName}
                        setName={setEditName}
                        targetAmount={editTargetAmount}
                        setTargetAmount={setEditTargetAmount}
                        currentAmount={editCurrentAmount}
                        setCurrentAmount={setEditCurrentAmount}
                        targetDate={editTargetDate}
                        setTargetDate={setEditTargetDate}
                        onSubmit={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                        submitLabel="Salvar"
                      />
                    </StaggerItem>
                  );
                }

                const pct =
                  goal.target_amount > 0
                    ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
                    : 0;
                const rawMonths = monthsRemaining(goal.target_date);
                const overdue = rawMonths <= 0;
                const effectiveMonths = Math.max(rawMonths, 1);
                const remaining = Math.max(
                  Number(goal.target_amount) - Number(goal.current_amount),
                  0
                );
                const perMonth = remaining / effectiveMonths;
                const reached = remaining === 0;

                return (
                  <StaggerItem key={goal.id} className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink dark:text-sage">{goal.name}</p>
                      <div className="flex gap-2">
                        <PressableButton
                          type="button"
                          onClick={() => startEdit(goal)}
                          className="rounded-full border border-line-soft px-2.5 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                        >
                          Editar
                        </PressableButton>
                        <PressableButton
                          type="button"
                          onClick={() => setPendingDelete(goal)}
                          className="rounded-full border border-wine px-2.5 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                        >
                          Excluir
                        </PressableButton>
                      </div>
                    </div>

                    <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                      {currency(Number(goal.current_amount))} de {currency(Number(goal.target_amount))}{" "}
                      · {Math.round(pct)}%
                    </p>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line-soft dark:bg-text-muted-dark/20">
                      <div
                        className={`h-full rounded-full ${
                          reached ? "bg-forest dark:bg-sage-mint" : "bg-amber"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-text-muted dark:text-text-muted-dark">
                      Meta: {dateLabel(goal.target_date)}
                      {reached ? (
                        <span className="text-forest dark:text-sage-mint"> · 🎉 valor alvo atingido</span>
                      ) : overdue ? (
                        <span className="text-wine dark:text-wine-dark">
                          {" "}
                          · prazo já passou — falta {currency(remaining)}
                        </span>
                      ) : (
                        <> · guarde {currency(perMonth)}/mês pra chegar lá</>
                      )}
                    </p>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}

          <div className="mt-4">
            {showNewForm ? (
              <GoalForm
                name={newName}
                setName={setNewName}
                targetAmount={newTargetAmount}
                setTargetAmount={setNewTargetAmount}
                currentAmount={newCurrentAmount}
                setCurrentAmount={setNewCurrentAmount}
                targetDate={newTargetDate}
                setTargetDate={setNewTargetDate}
                onSubmit={handleCreate}
                onCancel={() => setShowNewForm(false)}
                saving={saving}
                submitLabel="Criar meta"
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
                + Nova meta
              </PressableButton>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir meta"
        message={`Tem certeza que quer excluir "${pendingDelete?.name}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}

export default function MetasPage() {
  return (
    <Suspense fallback={null}>
      <MetasPageInner />
    </Suspense>
  );
}
