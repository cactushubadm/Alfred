"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton } from "@/components/motion/Pressable";

type Transaction = {
  id: string;
  type: "receita" | "despesa" | "transferencia";
  amount: number;
  description: string | null;
  due_date: string;
  status: string;
  categories: any;
  conta: any;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PendingList({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [payingId, setPayingId] = useState<string | null>(null);

  async function markAsPaid(id: string) {
    setPayingId(id);
    const { error } = await supabase.from("transactions").update({ status: "pago" }).eq("id", id);
    setPayingId(null);

    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
        Nenhuma conta pendente. Tudo em dia!
      </p>
    );
  }

  const today = todayISO();

  return (
    <StaggerList className="flex flex-col gap-2">
      {transactions.map((t) => {
        const overdue = t.due_date < today;
        const label = t.description || t.categories?.name || "Lançamento";

        return (
          <StaggerItem
            key={t.id}
            className={`rounded-card px-3.5 py-2.5 ${
              overdue
                ? "border border-wine bg-white dark:border-wine-dark dark:bg-surface-dark"
                : "bg-white dark:bg-surface-dark"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink dark:text-sage">{label}</p>
              <p
                className={`text-sm font-medium ${
                  t.type === "receita" ? "text-forest dark:text-sage-mint" : "text-wine dark:text-wine-dark"
                }`}
              >
                {t.type === "receita" ? "+" : "-"}
                {currency(Number(t.amount))}
              </p>
            </div>

            <div className="mt-1.5 flex items-center justify-between">
              <p
                className={`text-[11px] ${
                  overdue
                    ? "font-medium text-wine dark:text-wine-dark"
                    : "text-text-muted dark:text-text-muted-dark"
                }`}
              >
                {overdue ? "Atrasado · " : "Vence em "}
                {dateLabel(t.due_date)}
                {t.conta?.name ? ` · ${t.conta.name}` : ""}
              </p>
              <PressableButton
                type="button"
                onClick={() => markAsPaid(t.id)}
                disabled={payingId === t.id}
                className="rounded-full bg-forest px-3 py-1 text-[11px] font-medium text-white disabled:opacity-60"
              >
                {payingId === t.id ? "Salvando..." : "Marcar como pago"}
              </PressableButton>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
