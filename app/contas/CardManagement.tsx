"use client";

import { useState } from "react";
import { manageCard } from "./card-actions";
import { cardDeletionState, type CardLifecycleSummary } from "@/lib/card-lifecycle";
import { todaySaoPaulo } from "@/lib/cartao";
import { PressableButton } from "@/components/motion/Pressable";

const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const secondary = "rounded-full border border-line-soft px-3 py-2 text-xs text-forest dark:border-text-muted-dark/20 dark:text-sage-mint disabled:opacity-60";

export default function CardManagement({ card, onChange }: {
  card: { id: string; name: string; archived_at: string | null }; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<CardLifecycleSummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState("");
  const [paying, setPaying] = useState<string>();

  async function run(action: "inspect" | "archive" | "restore" | "delete" | "pay", itemId?: string, kind?: string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await manageCard({ id: card.id, action, name, itemId, kind });
      if (result.error) {
        setError(result.error);
        // Recarrega a decisão caso uma compra tenha sido inserida durante a confirmação.
        if (action === "delete") {
          const fresh = await manageCard({ id: card.id, action: "inspect" });
          if (fresh.data) setSummary(fresh.data);
        }
        return;
      }
      setSummary(result.data);
      setPaying(undefined);
      if (["archive", "restore", "delete"].includes(action)) {
        setOpen(false); setConfirmDelete(false); setName(""); onChange();
      }
    } catch {
      setError("Não foi possível concluir. Tente novamente.");
    } finally { setBusy(false); }
  }

  const state = summary ? cardDeletionState(summary, todaySaoPaulo()) : undefined;
  return (
    <div className="mt-3 border-t border-line-soft pt-3 dark:border-text-muted-dark/20">
      <PressableButton type="button" disabled={busy} className={secondary} onClick={() => {
        setOpen(!open); setConfirmDelete(false); setName("");
        if (!open) { setSummary(undefined); void run("inspect"); }
      }}>{open ? "Fechar opções" : "Gerenciar cartão"}</PressableButton>
      {open && (
        <section aria-label={`Gerenciar ${card.name}`} className="mt-3 flex flex-col gap-3 text-sm text-ink dark:text-sage">
          {busy && <p role="status">Carregando...</p>}
          {summary && state && <>
            <p>{summary.transactionCount} lançamentos e {summary.installmentCount} parcelas vinculados.</p>
            {!state.canDelete && <>
              <p className="text-wine dark:text-wine-dark">
                Este cartão tem {state.futureCount} parcelas futuras somando {money(state.futureAmount)}.
                {state.pendingCount > 0 && ` Há também ${state.pendingCount} pendências vencidas ou sem vencimento confirmado.`}
                {" "}Quite ou remova essas parcelas antes de excluir, ou arquive o cartão.
              </p>
              <p className="text-xs text-text-muted dark:text-text-muted-dark">
                Uma compra marcada como paga não confirma a quitação da fatura. Confirme abaixo somente parcelas já pagas e com a saída registrada na conta de origem.
              </p>
              <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                {summary.openItems.map(item => <li key={`${item.kind}-${item.id}`} className="rounded-card bg-sage p-3 dark:bg-ink">
                  <p>{item.description} · {money(Number(item.amount))}</p>
                  <p className="text-xs text-text-muted dark:text-text-muted-dark">
                    {item.installment_number ? `Parcela ${item.installment_number} · ` : ""}
                    {item.invoice_month ? `Fatura ${item.invoice_month} · ` : ""}
                    {item.due_date ? `Vence em ${item.due_date.split("-").reverse().join("/")}` : "Vencimento não informado"}
                  </p>
                  {paying === item.id ? <div className="mt-2 flex flex-col gap-2">
                    <p>Confirma que esta parcela já foi paga? Ela sairá dos compromissos em aberto.</p>
                    <PressableButton type="button" disabled={busy} className={secondary} onClick={() => void run("pay", item.id, item.kind)}>Confirmar pagamento</PressableButton>
                    <button type="button" disabled={busy} onClick={() => setPaying(undefined)}>Cancelar</button>
                  </div> : <PressableButton type="button" disabled={busy} className={`mt-2 ${secondary}`} onClick={() => setPaying(item.id)}>Marcar como paga</PressableButton>}
                </li>)}
              </ul>
            </>}
            {card.archived_at ? <PressableButton type="button" disabled={busy} className={secondary} onClick={() => void run("restore")}>Restaurar cartão</PressableButton>
              : state.hasHistory && <>
                <p className="text-xs text-text-muted dark:text-text-muted-dark">Arquivar retira o cartão do uso diário e preserva todo o histórico e as pendências.</p>
                <PressableButton type="button" disabled={busy} className="rounded-full bg-forest px-3 py-2 text-sm text-white disabled:opacity-60" onClick={() => void run("archive")}>Arquivar cartão</PressableButton>
              </>}
            {state.canDelete && <div className="border-t border-line-soft pt-3 dark:border-text-muted-dark/20">
              {confirmDelete ? <div className="flex flex-col gap-3">
                <p>{state.hasHistory ? "Os lançamentos e parcelas serão preservados. Os lançamentos perderão o vínculo e aparecerão como Cartão removido." : "O cartão não possui lançamentos nem parcelas. A exclusão é definitiva."}</p>
                <p>{summary.transactionCount} lançamentos e {summary.installmentCount} parcelas serão afetados.</p>
                <label>Digite o nome do cartão: <strong>{card.name}</strong>
                  <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-card border border-line-soft bg-white p-2 dark:border-text-muted-dark/20 dark:bg-surface-dark" />
                </label>
                <PressableButton type="button" disabled={busy || name !== card.name} className="rounded-full bg-wine px-3 py-2 text-white disabled:opacity-60" onClick={() => void run("delete")}>Confirmar exclusão definitiva</PressableButton>
                <button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setName(""); }}>Cancelar</button>
              </div> : <PressableButton type="button" disabled={busy} className="rounded-full border border-wine px-3 py-2 text-xs text-wine dark:border-wine-dark dark:text-wine-dark" onClick={() => setConfirmDelete(true)}>Excluir definitivamente</PressableButton>}
            </div>}
          </>}
        </section>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-wine dark:text-wine-dark">{error}</p>}
    </div>
  );
}
