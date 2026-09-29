"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNT_TYPES, AccountType, accountTypeLabel } from "@/lib/accounts";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton, PressableLink } from "@/components/motion/Pressable";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
};

function parseLimit(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDay(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), 1), 31);
}

// useSearchParams() exige um limite de Suspense (pro build estático não
// quebrar) — só o "new=1" do "+" da barra inferior depende dele, então o
// fallback nunca aparece de verdade na prática.
function ContasPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("corrente");
  const [editLimit, setEditLimit] = useState("");
  const [editClosingDay, setEditClosingDay] = useState("");
  const [editDueDay, setEditDueDay] = useState("");

  const [showNewForm, setShowNewForm] = useState(() => searchParams.get("new") === "1");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("corrente");
  const [newLimit, setNewLimit] = useState("");
  const [newClosingDay, setNewClosingDay] = useState("");
  const [newDueDay, setNewDueDay] = useState("");

  async function loadAccounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, type, credit_limit, closing_day, due_day")
      .order("name");

    if (error) {
      setError(error.message);
    } else {
      setAccounts(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditLimit(acc.credit_limit != null ? Number(acc.credit_limit).toFixed(2) : "");
    setEditClosingDay(acc.closing_day != null ? String(acc.closing_day) : "");
    setEditDueDay(acc.due_day != null ? String(acc.due_day) : "");
    setShowNewForm(false);
  }

  async function handleUpdate(id: string) {
    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({
        name: editName,
        type: editType,
        credit_limit: editType === "cartao" ? parseLimit(editLimit) : null,
        closing_day: editType === "cartao" ? parseDay(editClosingDay) : null,
        due_day: editType === "cartao" ? parseDay(editDueDay) : null,
      })
      .eq("id", id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    loadAccounts();
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
    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: newName,
      type: newType,
      credit_limit: newType === "cartao" ? parseLimit(newLimit) : null,
      closing_day: newType === "cartao" ? parseDay(newClosingDay) : null,
      due_day: newType === "cartao" ? parseDay(newDueDay) : null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewType("corrente");
    setNewLimit("");
    setNewClosingDay("");
    setNewDueDay("");
    setShowNewForm(false);
    loadAccounts();
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="rounded-t-sheet bg-forest px-5 py-4">
          <p className="font-display text-lg text-white">Contas</p>
        </div>

        <div className="rounded-b-sheet bg-sage pb-6 dark:bg-ink">
          {error && <p className="px-5 pt-4 text-sm text-wine dark:text-wine-dark">{error}</p>}

          <div className="mt-4 px-5">
            {loading ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Carregando...
              </p>
            ) : accounts.length === 0 ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Nenhuma conta cadastrada ainda.
              </p>
            ) : (
              <StaggerList className="flex flex-col gap-2">
                {accounts.map((acc) => {
                const isEditing = editingId === acc.id;

                if (isEditing) {
                  return (
                    <StaggerItem
                      key={acc.id}
                      className="flex flex-col gap-2 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark"
                    >
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                      />
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as AccountType)}
                        className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                      >
                        {ACCOUNT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {editType === "cartao" && (
                        <>
                          <MoneyInput
                            placeholder="Limite do cartão (opcional)"
                            value={editLimit}
                            onChange={setEditLimit}
                            className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              max={31}
                              placeholder="Dia do fechamento"
                              value={editClosingDay}
                              onChange={(e) => setEditClosingDay(e.target.value)}
                              className="w-1/2 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                            />
                            <input
                              type="number"
                              min={1}
                              max={31}
                              placeholder="Dia do vencimento"
                              value={editDueDay}
                              onChange={(e) => setEditDueDay(e.target.value)}
                              className="w-1/2 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                            />
                          </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <PressableButton
                          type="button"
                          onClick={() => handleUpdate(acc.id)}
                          disabled={saving}
                          className="flex-1 rounded-full bg-forest py-2 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Salvar
                        </PressableButton>
                        <PressableButton
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex-1 rounded-full border border-line-soft py-2 text-xs font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                        >
                          Cancelar
                        </PressableButton>
                      </div>
                    </StaggerItem>
                  );
                }

                return (
                  <StaggerItem
                    key={acc.id}
                    className="flex items-center justify-between rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark"
                  >
                    <div>
                      <p className="text-sm text-ink dark:text-sage">{acc.name}</p>
                      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                        {accountTypeLabel(acc.type)}
                        {acc.type === "cartao" && acc.credit_limit != null
                          ? ` · Limite: ${acc.credit_limit.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}`
                          : ""}
                        {acc.type === "cartao" && (acc.closing_day != null || acc.due_day != null)
                          ? ` · Fecha dia ${acc.closing_day ?? "?"}, vence dia ${acc.due_day ?? "?"}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {acc.type === "cartao" && (
                        <PressableLink
                          href={`/cartoes/${acc.id}`}
                          className="rounded-full border border-line-soft px-3 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                        >
                          Ver fatura
                        </PressableLink>
                      )}
                      <PressableButton
                        type="button"
                        onClick={() => startEdit(acc)}
                        className="rounded-full border border-line-soft px-3 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                      >
                        Editar
                      </PressableButton>
                    </div>
                  </StaggerItem>
                );
                })}
              </StaggerList>
            )}
          </div>

          <div className="mt-4 px-5">
            {showNewForm ? (
              <form
                onSubmit={handleCreate}
                className="flex flex-col gap-2 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark"
              >
                <input
                  type="text"
                  placeholder="Nome da conta"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AccountType)}
                  className="w-full rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {newType === "cartao" && (
                  <>
                    <MoneyInput
                      placeholder="Limite do cartão (opcional)"
                      value={newLimit}
                      onChange={setNewLimit}
                      className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Dia do fechamento"
                        value={newClosingDay}
                        onChange={(e) => setNewClosingDay(e.target.value)}
                        className="w-1/2 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                      />
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Dia do vencimento"
                        value={newDueDay}
                        onChange={(e) => setNewDueDay(e.target.value)}
                        className="w-1/2 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <PressableButton
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-full bg-forest py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Criar conta"}
                  </PressableButton>
                  <PressableButton
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="flex-1 rounded-full border border-line-soft py-2.5 text-sm font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                  >
                    Cancelar
                  </PressableButton>
                </div>
              </form>
            ) : (
              <PressableButton
                type="button"
                onClick={() => {
                  setShowNewForm(true);
                  setEditingId(null);
                }}
                className="block w-full rounded-full border border-forest py-3 text-center text-sm font-medium text-forest dark:border-text-muted-dark/30 dark:text-sage-mint"
              >
                + Nova conta
              </PressableButton>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

export default function ContasPage() {
  return (
    <Suspense fallback={null}>
      <ContasPageInner />
    </Suspense>
  );
}
