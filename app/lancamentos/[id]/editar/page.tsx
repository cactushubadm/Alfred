"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import CategoryPicker from "@/components/CategoryPicker";
import ToggleSwitch from "@/components/ToggleSwitch";

type MovementType = "receita" | "despesa" | "transferencia";
type Category = { id: string; name: string; icon: string; type: "receita" | "despesa" };
type Account = { id: string; name: string };

export default function EditarLancamentoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const supabase = createClient();

  const [type, setType] = useState<MovementType>("despesa");
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
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    supabase
      .from("accounts")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAccounts(data ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("transactions")
      .select(
        "id, type, amount, description, category_id, account_id, transfer_account_id, is_recurring, status, due_date"
      )
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
          setLoadingInitial(false);
          return;
        }

        setType(data.type);
        setAmount(Number(data.amount).toFixed(2));
        setDescription(data.description ?? "");

        if (data.type === "transferencia") {
          setFromAccountId(data.account_id ?? "");
          setToAccountId(data.transfer_account_id ?? "");
        } else {
          setCategoryId(data.category_id ?? "");
          setAccountId(data.account_id ?? "");
        }

        setIsRecurring(data.is_recurring);
        setIsPending(data.status !== "pago");
        if (data.due_date) setDueDate(data.due_date);
        setLoadingInitial(false);
      });
  }, [id]);

  useEffect(() => {
    if (type === "transferencia") {
      setCategories([]);
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

    if (type === "transferencia" && fromAccountId === toAccountId) {
      setError("Selecione contas diferentes para a transferência.");
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update(
        type === "transferencia"
          ? {
              type: "transferencia",
              amount: Number(amount),
              description: description || null,
              account_id: fromAccountId,
              transfer_account_id: toAccountId,
              category_id: null,
              is_recurring: false,
            }
          : {
              type,
              amount: Number(amount),
              description: description || null,
              category_id: categoryId || null,
              account_id: accountId || null,
              transfer_account_id: null,
              is_recurring: isRecurring,
              status: isPending ? "pendente" : "pago",
              due_date: isPending ? dueDate : null,
            }
      )
      .eq("id", id);

    if (error) {
      setError(error.message);
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    // sucesso: mantém o formulário travado até a navegação trocar de tela —
    // reabilitar aqui deixaria uma janela pra um segundo clique duplicar o
    // lançamento, já que router.push não espera a transição terminar
    router.push("/dashboard");
    router.refresh();
  }

  if (loadingInitial) {
    return (
      <main className="flex min-h-screen justify-center bg-sage p-4 dark:bg-ink">
        <div className="w-full max-w-sm rounded-sheet bg-white p-5 dark:bg-surface-dark">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">Carregando...</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen justify-center bg-sage p-4 dark:bg-ink">
        <div className="w-full max-w-sm rounded-sheet bg-white p-5 dark:bg-surface-dark">
          <p className="text-sm text-wine dark:text-wine-dark">Lançamento não encontrado.</p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-sm text-forest underline dark:text-sage-mint"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 dark:bg-ink">
      <div className="w-full max-w-sm rounded-sheet bg-white dark:bg-surface-dark">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Editar lançamento</p>
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
          ) : (
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Transferência entre contas
            </p>
          )}

          <MoneyInput
            required
            value={amount}
            onChange={setAmount}
            className="rounded-card border border-line-soft px-3.5 py-3 text-center text-2xl outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />

          {type === "transferencia" ? (
            <>
              <select
                required
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full rounded-card border border-line-soft px-3.5 py-2.5 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
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
                className="w-full rounded-card border border-line-soft px-3.5 py-2.5 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
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
                className="w-full rounded-card border border-line-soft px-3.5 py-2.5 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
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
            className="w-full rounded-card border border-line-soft px-3.5 py-2.5 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />

          {type !== "transferencia" && (
            <div className="flex items-center justify-between text-sm text-text-muted dark:text-text-muted-dark">
              Repetir todo mês
              <ToggleSwitch checked={isRecurring} onChange={setIsRecurring} />
            </div>
          )}

          {type !== "transferencia" && (
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
                  className="w-full rounded-card border border-line-soft px-3.5 py-2.5 text-sm outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                />
              )}
            </div>
          )}

          {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </div>
    </main>
  );
}
