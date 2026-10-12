"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import CategoryPicker from "@/components/CategoryPicker";
import ToggleSwitch from "@/components/ToggleSwitch";

import { cardSchedule, todaySaoPaulo } from "@/lib/cartao";

type MovementType = "receita" | "despesa" | "transferencia";
type Category = { id: string; name: string; icon: string; type: "receita" | "despesa" };
type Account = { id: string; name: string; type: string; closing_day: number | null; due_day: number | null };

// Divide um valor em N parcelas de 2 casas decimais cuja soma bate
// exatamente com o valor original (os centavos que sobram vão nas
// primeiras parcelas).
function splitInstallments(totalAmount: number, count: number): number[] {
  const totalCents = Math.round(totalAmount * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

// useSearchParams() exige um limite de Suspense (pro build estático não
// quebrar) — só o "?type=" do "+" da barra inferior depende dele, então o
// fallback nunca aparece de verdade na prática.
function NovoLancamentoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Vem do "+" da barra inferior, que já leva direto pro tipo escolhido
  // (nova despesa / nova receita / transferência) em vez de sempre abrir
  // em "despesa" e exigir mais um toque.
  const initialType = searchParams.get("type");
  const [type, setType] = useState<MovementType>(
    initialType === "receita" || initialType === "transferencia" ? initialType : "despesa"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [dueDate, setDueDate] = useState(() => todaySaoPaulo());
  const [purchaseDate, setPurchaseDate] = useState(todaySaoPaulo);
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    supabase
      .from("accounts")
      .select("id, name, type, closing_day, due_day")
      .is("archived_at", null)
      .order("name")
      .then(({ data }) => setAccounts(data ?? []));
  }, []);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isCardAccount = selectedAccount?.type === "cartao";

  let preview: ReturnType<typeof cardSchedule>[number] | undefined;
  let cardError: string | undefined;
  if (type === "despesa" && isCardAccount) {
    try { preview = cardSchedule(purchaseDate, selectedAccount!.closing_day!, selectedAccount!.due_day!)[0]; }
    catch (error) { cardError = (error as Error).message; }
  }

  useEffect(() => {
    if (!isCardAccount) setIsInstallment(false);
  }, [isCardAccount]);

  useEffect(() => {
    if (type === "transferencia") {
      setCategories([]);
      setCategoryId("");
      return;
    }
    supabase
      .from("categories")
      .select("id, name, icon, type")
      .eq("type", type)
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, [type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login novamente.");
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    if (type === "transferencia" && fromAccountId === toAccountId) {
      setError("Selecione contas diferentes para a transferência.");
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    const installmentCount = parseInt(totalInstallments, 10);
    const isParceled =
      type === "despesa" && isCardAccount && isInstallment && installmentCount >= 2;

    let schedule: ReturnType<typeof cardSchedule> = [];
    try {
      if (type === "despesa" && isCardAccount) {
        schedule = cardSchedule(purchaseDate, selectedAccount!.closing_day!, selectedAccount!.due_day!, isParceled ? installmentCount : 1);
        if (isInstallment && !isParceled) throw new Error("Número de parcelas inválido.");
      }
    } catch (error) {
      setError((error as Error).message);
      submittingRef.current = false;
      setLoading(false);
      return;
    }
    const totalAmount = Number(amount);
    const parts = isParceled ? splitInstallments(totalAmount, installmentCount) : null;

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(
        type === "transferencia"
          ? {
              occurred_at: purchaseDate || todaySaoPaulo(),
              user_id: user.id,
              type: "transferencia",
              amount: totalAmount,
              description: description || null,
              account_id: fromAccountId,
              transfer_account_id: toAccountId,
              is_recurring: false,
            }
          : {
              occurred_at: purchaseDate || todaySaoPaulo(),
              user_id: user.id,
              type,
              amount: parts ? parts[0] : totalAmount,
              description: description || null,
              category_id: categoryId || null,
              account_id: accountId || null,
              invoice_month: schedule[0]?.invoice_month ?? null,
              card_due_date: schedule[0]?.due_date ?? null,
              is_recurring: schedule.length ? false : isRecurring,
              status: !schedule.length && isPending ? "pendente" : "pago",
              due_date: !schedule.length && isPending ? dueDate : null,
            }
      )
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    if (parts && inserted) {
      const futureInstallments = parts.slice(1).map((partAmount, idx) => ({
        user_id: user.id,
        transaction_id: inserted.id,
        installment_number: idx + 2,
        total_installments: installmentCount,
        amount: partAmount,
        ...schedule[idx + 1],
      }));

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(futureInstallments);

      if (installmentsError) {
        await supabase.from("transactions").delete().eq("id", inserted.id);
        setError(installmentsError.message);
        submittingRef.current = false;
        setLoading(false);
        return;
      }
    }

    // sucesso: mantém o formulário travado até a navegação trocar de tela —
    // reabilitar aqui deixaria uma janela pra um segundo clique duplicar o
    // lançamento, já que router.push não espera a transição terminar
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 dark:bg-ink">
      <div className="w-full max-w-sm rounded-sheet bg-white dark:bg-surface-dark">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Novo lançamento</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {type !== "transferencia" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("despesa")}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                  type === "despesa"
                    ? "bg-wine text-white"
                    : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                }`}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setType("receita")}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                  type === "receita"
                    ? "bg-forest text-white"
                    : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                }`}
              >
                Receita
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setType(type === "transferencia" ? "despesa" : "transferencia")}
            className={`self-start text-xs underline ${
              type === "transferencia"
                ? "text-ink dark:text-sage"
                : "text-text-muted dark:text-text-muted-dark"
            }`}
          >
            {type === "transferencia" ? "← Voltar" : "Transferir entre contas"}
          </button>

          <label className="text-sm text-text-muted dark:text-text-muted-dark">
            Data da compra / lançamento
            <input type="date" required value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
              className="mt-1 w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-ink dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage" />
          </label>

          <MoneyInput
            required
            value={amount}
            onChange={setAmount}
            className="rounded-card border border-line-soft bg-white px-3.5 py-3 text-center text-2xl text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />

          {type === "transferencia" ? (
            <>
              <select
                required
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
              >
                <option value="" disabled>
                  De qual conta?
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                required
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
              >
                <option value="" disabled>
                  Para qual conta?
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
              >
                <option value="">Sem conta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />

          {type !== "transferencia" && !(type === "despesa" && isCardAccount) && (
            <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
              Repetir todo mês
              <ToggleSwitch checked={isRecurring} onChange={setIsRecurring} />
            </div>
          )}

          {type !== "transferencia" && !(type === "despesa" && isCardAccount) && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
                {type === "despesa" ? "Ainda não paguei" : "Ainda não recebi"}
                <ToggleSwitch checked={isPending} onChange={setIsPending} />
              </div>
              {isPending && (
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              )}
            </div>
          )}

          {type === "despesa" && isCardAccount && (
            <div className="flex flex-col gap-2 rounded-card border border-line-soft p-3 dark:border-text-muted-dark/20">
              <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
                Compra parcelada
                <ToggleSwitch checked={isInstallment} onChange={setIsInstallment} />
              </div>
              {isInstallment && (
                <>
                  <input
                    type="number"
                    min={2}
                    max={48}
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                  />
                  {Number(amount) > 0 && parseInt(totalInstallments, 10) >= 2 && (
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                      {parseInt(totalInstallments, 10)}x de{" "}
                      {(Number(amount) / parseInt(totalInstallments, 10)).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {preview && (
            <p className="text-xs text-text-muted dark:text-text-muted-dark" aria-live="polite">
              Primeira parcela na fatura de {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(preview.invoice_month + "-01T12:00:00-03:00"))}, vence em {preview.due_date.split("-").reverse().join("/")}.
            </p>
          )}
          {cardError && <p className="text-sm text-wine dark:text-wine-dark">{cardError}</p>}
          {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}

          <button
            type="submit"
            disabled={loading || !!cardError}
            className="rounded-full bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading
              ? "Salvando..."
              : type === "transferencia"
              ? "Salvar transferência"
              : "Salvar lançamento"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NovoLancamentoPage() {
  return (
    <Suspense fallback={null}>
      <NovoLancamentoPageInner />
    </Suspense>
  );
}
