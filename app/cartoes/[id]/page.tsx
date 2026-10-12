import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardSchedule, todaySaoPaulo } from "@/lib/cartao";
import BottomNav from "@/components/BottomNav";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

export default async function CartaoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, credit_limit, closing_day, due_day")
    .eq("id", params.id)
    .eq("type", "cartao")
    .maybeSingle();

  if (!account) notFound();

  const todayISO = todaySaoPaulo();
  const invoiceMonth = account.closing_day && account.due_day
    ? cardSchedule(todayISO, account.closing_day, account.due_day)[0].invoice_month
    : todayISO.slice(0, 7);

  const [{ data: purchases }, { data: installmentRows }] = await Promise.all([
    supabase.from("transactions").select("id, amount, description, invoice_month, card_due_date")
      .eq("account_id", account.id).eq("type", "despesa"),
    supabase.from("installments")
      .select("id, installment_number, total_installments, amount, due_date, invoice_month, transactions!inner(id, account_id, description)")
      .eq("transactions.account_id", account.id).order("due_date"),
  ]);

  const installments = (installmentRows ?? []).map((row) => ({
    id: row.id as string,
    transactionId: (row.transactions as unknown as { id: string }).id,
    installmentNumber: row.installment_number as number,
    totalInstallments: row.total_installments as number,
    amount: Number(row.amount),
    dueDate: row.due_date as string,
    invoiceMonth: row.invoice_month as string,
    description: (row.transactions as unknown as { description: string | null }).description,
  }));

  const currentCyclePurchases = (purchases ?? []).filter(
    (t) => t.invoice_month === invoiceMonth
  );
  const currentCycleInstallments = installments.filter(
    (i) => i.invoiceMonth === invoiceMonth
  );

  const faturaAtual =
    currentCyclePurchases.reduce((sum, t) => sum + Number(t.amount), 0) +
    currentCycleInstallments.reduce((sum, i) => sum + i.amount, 0);

  // Compromissos além desta fatura: parcelas futuras que ainda vão cair em
  // faturas seguintes — é o que faz o limite disponível não ser só
  // "limite − fatura atual".
  const futureBeyondCycle = installments
    .filter((i) => i.invoiceMonth > invoiceMonth)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalCommitted = faturaAtual + futureBeyondCycle + (purchases ?? [])
    .filter(t => t.invoice_month > invoiceMonth).reduce((sum, t) => sum + Number(t.amount), 0);
  const limiteDisponivel =
    account.credit_limit != null ? Number(account.credit_limit) - totalCommitted : null;

  const firstInstallments = (purchases ?? []).filter(t => t.invoice_month && t.card_due_date).map(t => ({
    id: t.id as string, installmentNumber: 1,
    totalInstallments: installments.find(i => i.transactionId === t.id)?.totalInstallments ?? 1,
    amount: Number(t.amount), dueDate: t.card_due_date as string,
    invoiceMonth: t.invoice_month as string, description: t.description as string | null,
  }));
  const openInstallments = [...firstInstallments, ...installments]
    .filter((i) => i.dueDate >= todayISO)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/contas" aria-label="Voltar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">{account.name}</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Fatura atual</p>
              <p className="mt-1 text-lg font-medium text-wine dark:text-wine-dark">
                {currency(faturaAtual)}
              </p>
              <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                {invoiceMonth.split("-").reverse().join("/")}
              </p>
            </div>
            <div className="rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
              <p className="text-xs text-text-muted dark:text-text-muted-dark">Limite disponível</p>
              <p className="mt-1 text-lg font-medium text-forest dark:text-sage-mint">
                {limiteDisponivel != null ? currency(limiteDisponivel) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
                {account.credit_limit != null
                  ? `de ${currency(Number(account.credit_limit))} (já considera parcelas futuras)`
                  : "defina um limite na conta"}
              </p>
            </div>
          </div>

          {(account.closing_day == null || account.due_day == null) && (
            <p className="mt-2.5 text-[11px] text-amber">
              Defina o dia de fechamento e vencimento em{" "}
              <Link href="/contas" className="underline">
                Contas
              </Link>{" "}
              para lançar compras neste cartão.
            </p>
          )}

          <p className="mt-5 text-sm text-ink dark:text-sage">Parcelas em aberto</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {openInstallments.length === 0 ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Nenhuma parcela futura em aberto.
              </p>
            ) : (
              openInstallments.map((i) => {
                const remaining = i.totalInstallments - i.installmentNumber + 1;
                return (
                  <div
                    key={i.id}
                    className="flex items-center justify-between rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark"
                  >
                    <div>
                      <p className="text-sm text-ink dark:text-sage">
                        {i.description || "Compra parcelada"}
                      </p>
                      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                        Parcela {i.installmentNumber}/{i.totalInstallments} · vence em{" "}
                        {dateLabel(i.dueDate)} · faltam {remaining}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-ink dark:text-sage">
                      {currency(i.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
