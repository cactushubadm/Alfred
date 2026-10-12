import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import PendingList from "./PendingList";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

export default async function ContasAPagarPage() {
  const supabase = createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, description, due_date, status, removed_card, categories(name), conta:accounts!account_id(name)"
    )
    .in("status", ["pendente", "atrasado"])
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Contas a pagar/receber</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <PendingList transactions={transactions ?? []} />
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
