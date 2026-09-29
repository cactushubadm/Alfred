import type { SupabaseClient } from "@supabase/supabase-js";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addMonthToMonthDate(monthDate: string, delta: number) {
  const [y, m] = monthDate.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad2(nm)}-01`;
}

// Meses estritamente entre `fromMonth` e `toMonth` (os dois de fora) —
// comparáveis como texto porque o formato é sempre AAAA-MM-01.
function monthsBetweenExclusive(fromMonth: string, toMonth: string): string[] {
  const result: string[] = [];
  let cursor = addMonthToMonthDate(fromMonth, 1);
  while (cursor < toMonth) {
    result.push(cursor);
    cursor = addMonthToMonthDate(cursor, 1);
  }
  return result;
}

// Calcula o patrimônio líquido atual e salva (upsert) o snapshot do mês
// corrente em `net_worth_snapshots`, pra alimentar o histórico aos poucos —
// sem job de fundo, só quando o usuário abre a tela (mesmo espírito de
// `generateDueRecurringTransactions`).
export async function computeAndSnapshotNetWorth(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const monthDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;

  // As 8 consultas abaixo são todas independentes entre si — só o cálculo
  // final e os upserts dependem delas — então rodam em paralelo.
  const [
    { data: accounts },
    { data: transactions },
    { data: reservaProfile },
    { data: reserveMovements },
    { data: longoPrazoProfile },
    { data: debts },
    { data: openInstallments },
    { data: lastSnapshot },
  ] = await Promise.all([
    supabase.from("accounts").select("id, type"),
    supabase.from("transactions").select("type, amount, account_id, transfer_account_id"),
    supabase.from("investment_profiles").select("current_balance").eq("type", "reserva").maybeSingle(),
    supabase.from("reserve_movements").select("amount"),
    supabase
      .from("investment_profiles")
      .select("current_balance")
      .eq("type", "longo_prazo")
      .maybeSingle(),
    supabase.from("debts").select("balance"),
    supabase
      .from("installments")
      .select("amount, due_date")
      .gte("due_date", new Date().toISOString().slice(0, 10)),
    supabase
      .from("net_worth_snapshots")
      .select("month_date, assets, liabilities, net_worth")
      .lt("month_date", monthDate)
      .order("month_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const accountTypeById = new Map((accounts ?? []).map((a) => [a.id, a.type as string]));

  // Saldo das contas: soma de todos os lançamentos desde sempre, exceto
  // contas do tipo cartão — o crédito usado no cartão já vira passivo via
  // `installments`, não faz sentido também contar como "saldo" positivo.
  let contasBalance = 0;
  (transactions ?? []).forEach((t) => {
    const amount = Number(t.amount);
    const originIsCard = t.account_id ? accountTypeById.get(t.account_id) === "cartao" : true;
    const destIsCard = t.transfer_account_id
      ? accountTypeById.get(t.transfer_account_id) === "cartao"
      : true;

    if (t.type === "receita") {
      if (!originIsCard) contasBalance += amount;
    } else if (t.type === "despesa") {
      if (!originIsCard) contasBalance -= amount;
    } else if (t.type === "transferencia") {
      if (!originIsCard) contasBalance -= amount;
      if (!destIsCard) contasBalance += amount;
    }
  });

  // Investimentos: reserva = saldo inicial guardado no perfil + histórico
  // de movimentações (mesmo cálculo de `app/investimentos/page.tsx`).
  const reservaTotal =
    (reservaProfile ? Number(reservaProfile.current_balance) : 0) +
    (reserveMovements ?? []).reduce((sum, m) => sum + Number(m.amount), 0);

  const longoPrazoBalance = longoPrazoProfile ? Number(longoPrazoProfile.current_balance) : 0;

  // Passivos: saldo devedor das dívidas + parcelas futuras ainda não
  // vencidas (mesma definição de "em aberto" usada em `app/cartoes/[id]`).
  const debtsSum = (debts ?? []).reduce((sum, d) => sum + Number(d.balance), 0);
  const installmentsSum = (openInstallments ?? []).reduce((sum, i) => sum + Number(i.amount), 0);

  const assets = contasBalance + reservaTotal + longoPrazoBalance;
  const liabilities = debtsSum + installmentsSum;
  const netWorth = assets - liabilities;

  // Preenche os meses em que o usuário não abriu essa tela (e portanto
  // nunca calculamos o valor real) repetindo o último snapshot conhecido,
  // marcado como estimado — assim o histórico não fica com buracos só
  // porque a visita não caiu naquele mês. Os dois upserts abaixo escrevem
  // meses diferentes (o gap nunca inclui o mês corrente), então também
  // rodam em paralelo.
  const gapMonths = lastSnapshot
    ? monthsBetweenExclusive(lastSnapshot.month_date as string, monthDate)
    : [];

  await Promise.all([
    gapMonths.length > 0 && lastSnapshot
      ? supabase.from("net_worth_snapshots").upsert(
          gapMonths.map((m) => ({
            user_id: userId,
            month_date: m,
            assets: Number(lastSnapshot.assets),
            liabilities: Number(lastSnapshot.liabilities),
            net_worth: Number(lastSnapshot.net_worth),
            estimated: true,
          })),
          { onConflict: "user_id,month_date" }
        )
      : Promise.resolve(null),
    supabase.from("net_worth_snapshots").upsert(
      {
        user_id: userId,
        month_date: monthDate,
        assets,
        liabilities,
        net_worth: netWorth,
        estimated: false,
      },
      { onConflict: "user_id,month_date" }
    ),
  ]);

  return { assets, liabilities, netWorth, contasBalance, reservaTotal, longoPrazoBalance, debtsSum, installmentsSum };
}
