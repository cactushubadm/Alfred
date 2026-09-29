"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton, PressableLink } from "@/components/motion/Pressable";

type Transaction = {
  id: string;
  type: "receita" | "despesa" | "transferencia";
  amount: number;
  description: string | null;
  occurred_at: string;
  categories: any;
  origem: any;
  destino: any;
};

export default function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("transactions").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      alert(error.message);
      return;
    }
    setPendingDelete(null);
    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
        Nenhum lançamento este mês ainda.
      </p>
    );
  }

  return (
    <>
      <StaggerList className="flex flex-col gap-2">
        {transactions.map((t) => {
          const label =
            t.description ||
            (t.type === "transferencia"
              ? `Transferência: ${(t.origem as any)?.name ?? "?"} → ${
                  (t.destino as any)?.name ?? "?"
                }`
              : (t.categories as any)?.name) ||
            "Lançamento";

          return (
            <StaggerItem key={t.id} className="rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink dark:text-sage">{label}</p>
                <p
                  className={`text-sm font-medium ${
                    t.type === "receita"
                      ? "text-forest dark:text-sage-mint"
                      : t.type === "despesa"
                      ? "text-wine dark:text-wine-dark"
                      : "text-text-muted dark:text-text-muted-dark"
                  }`}
                >
                  {t.type === "receita" ? "+" : t.type === "despesa" ? "-" : "⇄ "}
                  {Number(t.amount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                  {new Date(t.occurred_at).toLocaleDateString("pt-BR")}
                </p>
                <div className="flex gap-2">
                  <PressableLink
                    href={`/lancamentos/${t.id}/editar`}
                    className="rounded-full border border-line-soft px-3 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                  >
                    Editar
                  </PressableLink>
                  <PressableButton
                    type="button"
                    onClick={() => setPendingDelete({ id: t.id, label })}
                    className="rounded-full border border-wine px-3 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                  >
                    Excluir
                  </PressableButton>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerList>

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir lançamento"
        message={`Tem certeza que quer excluir "${pendingDelete?.label}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
