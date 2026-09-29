// Fórmulas financeiras reaproveitadas em mais de uma tela (Wave 2 em
// diante) — mantidas num só lugar pra não divergir entre simuladores.

// VF = VP(1+i)^n + PMT * [((1+i)^n - 1) / i], i = taxa mensal equivalente.
// PMT negativo simula retiradas (ex.: pagar parcelas com o valor investido).
export function futureValue(
  presentValue: number,
  monthlyContribution: number,
  monthlyRate: number,
  months: number
) {
  if (monthlyRate === 0) {
    return presentValue + monthlyContribution * months;
  }
  const growth = Math.pow(1 + monthlyRate, months);
  return presentValue * growth + monthlyContribution * ((growth - 1) / monthlyRate);
}

// Taxa mensal equivalente a uma taxa anual (composição), ex.: 8% a.a. -> ~0,64% a.m.
export function annualToMonthlyRate(annualRatePercent: number) {
  return Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
}

// Parcela de uma amortização (Price/Tabela Price): valor fixo por período
// que quita `principal` em `months` parcelas a uma taxa mensal `monthlyRate`.
// Com taxa 0, degenera pra divisão simples do principal pelo número de parcelas.
export function amortizationPayment(principal: number, monthlyRate: number, months: number) {
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-01" -> primeiro e último dia do mês, ambos "YYYY-MM-DD" — usado
// pelo relatório mensal e pela previsão de meses futuros (lib/cashFlow.ts),
// pra não duplicar essa conta em cada lugar que lida com "um mês inteiro".
export function monthBounds(monthDate: string) {
  const [y, m] = monthDate.split("-").map(Number);
  const first = `${y}-${pad2(m)}-01`;
  const last = new Date(y, m, 0).toISOString().slice(0, 10);
  return { first, last };
}

// Meses inteiros entre hoje e uma data-alvo (pode ser <= 0 se já passou) —
// mesmo cálculo usado em app/metas/page.tsx.
export function monthsUntil(targetDateISO: string): number {
  const today = new Date();
  const [y, m, d] = targetDateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
}

// Quanto uma meta ainda exige guardar por mês pra chegar no valor-alvo até
// a data-alvo — mesma fórmula usada em app/metas/page.tsx (meta atrasada
// vira "precisa de tudo em até 1 mês", pra não subestimar o compromisso).
export function goalMonthlyRequirement(
  targetAmount: number,
  currentAmount: number,
  targetDateISO: string
) {
  const effectiveMonths = Math.max(monthsUntil(targetDateISO), 1);
  const remaining = Math.max(targetAmount - currentAmount, 0);
  return remaining / effectiveMonths;
}

// Comparativo simples "esse mês vs. o anterior" — mesmo texto usado no
// dashboard e no relatório mensal.
export function monthChange(current: number, previous: number, higherIsBetter: boolean) {
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const up = diff >= 0;
  const good = higherIsBetter ? up : !up;

  const label =
    previous !== 0
      ? `${up ? "↑" : "↓"} ${Math.abs((diff / previous) * 100).toFixed(0)}% vs mês passado`
      : `${up ? "+" : "-"} ${Math.abs(diff).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} vs mês passado`;

  return { label, good };
}
