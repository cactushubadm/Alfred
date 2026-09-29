import type { SupabaseClient } from "@supabase/supabase-js";

export type ReserveStatus = {
  total: number;
  // meta = 6x a média de gastos reais dos últimos 6 meses; null se ainda
  // não há histórico de despesas suficiente pra estimar
  target: number | null;
};

// Reserva de emergência: saldo inicial do perfil (`investment_profiles`,
// type='reserva') + soma do histórico de movimentações (`reserve_movements`)
// — mesmo cálculo usado em `app/investimentos/page.tsx` e
// `app/estimativa-de-compra/page.tsx`.
export async function getReserveStatus(supabase: SupabaseClient): Promise<ReserveStatus> {
  const { data: reservaProfile } = await supabase
    .from("investment_profiles")
    .select("current_balance")
    .eq("type", "reserva")
    .maybeSingle();
  const { data: movements } = await supabase.from("reserve_movements").select("amount");
  const total =
    (reservaProfile ? Number(reservaProfile.current_balance) : 0) +
    (movements ?? []).reduce((sum, m) => sum + Number(m.amount), 0);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: despesas } = await supabase
    .from("transactions")
    .select("amount, occurred_at")
    .eq("type", "despesa")
    .gte("occurred_at", sixMonthsAgo.toISOString().slice(0, 10));

  let target: number | null = null;
  if (despesas && despesas.length > 0) {
    const byMonth = new Map<string, number>();
    despesas.forEach((t) => {
      const key = (t.occurred_at as string).slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
    });
    const avgMonthlyExpense = Array.from(byMonth.values()).reduce((s, v) => s + v, 0) / byMonth.size;
    target = avgMonthlyExpense * 6;
  }

  return { total, target };
}
