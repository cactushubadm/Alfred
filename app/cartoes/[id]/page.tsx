import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function addMonths(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// Ciclo de fatura em aberto: [início, fim], como strings ISO (comparáveis
// como texto porque o formato é sempre AAAA-MM-DD). Sem dia de fechamento
// definido, cai de volta pro mês calendário como aproximação razoável.
function currentInvoiceCycle(todayISO: string, closingDay: number | null) {
  const [ty, tm, td] = todayISO.split("-").map(Number);

  if (closingDay == null) {
    return { start: ymd(ty, tm, 1), end: ymd(ty, tm, daysInMonth(ty, tm)) };
  }

  const thisClose = Math.min(closingDay, daysInMonth(ty, tm));

  if (td <= thisClose) {
    const prev = addMonths(ty, tm, -1);
    const prevClose = Math.min(closingDay, daysInMonth(prev.year, prev.month));
    const startDay = prevClose + 1;
    const start =
      startDay > daysInMonth(prev.year, prev.month)
        ? ymd(ty, tm, 1)
        : ymd(prev.year, prev.month, startDay);
    return { start, end: ymd(ty, tm, thisClose) };
  }

  const next = addMonths(ty, tm, 1);
  const nextClose = Math.min(closingDay, daysInMonth(next.year, next.month));
  const startDay = thisClose + 1;
  const start =
    startDay > daysInMonth(ty, tm) ? ymd(next.year, next.month, 1) : ymd(ty, tm, startDay);
  return { start, end: ymd(next.year, next.month, nextClose) };
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

  const todayISO = new Date().toISOString().slice(0, 10);
  const cycle = currentInvoiceCycle(todayISO, account.closing_day);

  const { data: purchases } = await supabase
    .from("transactions")
    .select("id, amount, description, occurred_at")
    .eq("account_id", account.id)
    .eq("type", "despesa");

  const { data: installmentRows } = await supabase
    .from("installments")
    .select(
      "id, installment_number, total_installments, amount, due_date, transactions!inner(account_id, description)"
    )
    .eq("transactions.account_id", account.id)
    .order("due_date");

  const installments = (installmentRows ?? []).map((row) => ({
    id: row.id as string,
    installmentNumber: row.installment_number as number,
    totalInstallments: row.total_installments as number,
    amount: Number(row.amount),
    dueDate: row.due_date as string,
    description: (row.transactions as unknown as { description: string | null }).description,
  }));

  const currentCyclePurchases = (purchases ?? []).filter(
    (t) => t.occurred_at >= cycle.start && t.occurred_at <= cycle.end
  );
  const currentCycleInstallments = installments.filter(
    (i) => i.dueDate >= cycle.start && i.dueDate <= cycle.end
  );

  const faturaAtual =
    currentCyclePurchases.reduce((sum, t) => sum + Number(t.amount), 0) +
    currentCycleInstallments.reduce((sum, i) => sum + i.amount, 0);

  // Compromissos além desta fatura: parcelas futuras que ainda vão cair em
  // faturas seguintes — é o que faz o limite disponível não ser só
  // "limite − fatura atual".
  const futureBeyondCycle = installments
    .filter((i) => i.dueDate > cycle.end)
    .reduce((sum, i) => sum + i.amount, 0);

  const totalCommitted = faturaAtual + futureBeyondCycle;
  const limiteDisponivel =
    account.credit_limit != null ? Number(account.credit_limit) - totalCommitted : null;

  const openInstallments = installments
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
                {dateLabel(cycle.start)} – {dateLabel(cycle.end)}
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
              para uma fatura mais precisa — por ora, considerando o mês
              calendário.
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
