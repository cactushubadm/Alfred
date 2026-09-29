// Score de saúde financeira (0-100), exibido no dashboard.
//
// FÓRMULA (v1 — pesos e limiares abaixo são um ponto de partida
// deliberadamente simples, pra ajustar com base em feedback real de uso;
// ver decisão espelhada em CLAUDE.md, Wave 4):
//
//   score = média ponderada de 4 componentes, cada um também 0-100:
//
//   1) poupança (peso 0.35): taxa de poupança do mês = saldo/recebido.
//      0% ou menos -> 0 pontos; 20% ou mais -> 100 pontos (20% é um
//      benchmark comum de educação financeira); linear entre os dois.
//
//   2) orçamento (peso 0.25): % das categorias com orçamento mensal
//      definido que ficaram dentro do limite no mês.
//
//   3) reserva de emergência (peso 0.25): saldo atual da reserva / meta
//      (6x a média de gastos reais dos últimos 6 meses), até 100%.
//
//   4) dívidas caras (peso 0.15): % das dívidas em aberto cuja taxa de
//      juros anualizada NÃO ultrapassa a taxa de retorno esperada do
//      investimento de longo prazo (sem dívida nenhuma = 100 pontos).
//
// Qualquer componente sem dado suficiente pra ser calculado (ex.: usuário
// não definiu orçamento nenhum, ou não tem perfil de investimento de longo
// prazo mas tem dívidas) fica de fora da média, e os pesos dos componentes
// restantes são renormalizados pra somar 100% — nunca penalizamos o score
// por ausência de dado, só pelo que foi medido. Se nenhum componente for
// mensurável (conta muito nova), o score inteiro é `null` (não exibir nota
// nenhuma é mais honesto que mostrar um número inventado).

const WEIGHTS = {
  savings: 0.35,
  budget: 0.25,
  reserve: 0.25,
  debt: 0.15,
};

const SAVINGS_RATE_FOR_MAX_SCORE = 0.2; // 20% de poupança = nota máxima nesse componente

export type HealthScoreInput = {
  recebido: number;
  saldo: number;
  budgetedCategories: { spent: number; budget: number }[]; // só categorias com monthly_budget definido
  reserveTotal: number;
  reserveTarget: number | null;
  debts: { monthlyInterestRate: number }[]; // só dívidas com saldo devedor > 0
  investAnnualRate: number | null; // expected_annual_rate do perfil de longo prazo
};

export type HealthScoreResult = {
  score: number | null;
  breakdown: {
    savings: number | null;
    budget: number | null;
    reserve: number | null;
    debt: number | null;
  };
};

function savingsComponent(recebido: number, saldo: number): number | null {
  if (recebido <= 0) {
    // sem receita no mês: só dá pra avaliar se também não houve gasto
    // (mês sem lançamento nenhum ainda, fora da média) — gastar sem
    // nenhuma receita registrada é o pior caso, não "sem dado"
    return recebido === 0 && saldo === 0 ? null : 0;
  }
  const rate = saldo / recebido;
  return Math.max(0, Math.min(1, rate / SAVINGS_RATE_FOR_MAX_SCORE)) * 100;
}

function budgetComponent(categories: { spent: number; budget: number }[]): number | null {
  if (categories.length === 0) return null;
  const withinBudget = categories.filter((c) => c.spent <= c.budget).length;
  return (withinBudget / categories.length) * 100;
}

function reserveComponent(total: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.max(0, Math.min(1, total / target)) * 100;
}

function debtComponent(
  debts: { monthlyInterestRate: number }[],
  investAnnualRate: number | null
): number | null {
  if (debts.length === 0) return 100;
  if (investAnnualRate == null) return null;
  const expensive = debts.filter((d) => {
    const annualEquivalent = (Math.pow(1 + d.monthlyInterestRate / 100, 12) - 1) * 100;
    return annualEquivalent > investAnnualRate;
  }).length;
  return ((debts.length - expensive) / debts.length) * 100;
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const savings = savingsComponent(input.recebido, input.saldo);
  const budget = budgetComponent(input.budgetedCategories);
  const reserve = reserveComponent(input.reserveTotal, input.reserveTarget);
  const debt = debtComponent(input.debts, input.investAnnualRate);

  const measured = [
    { value: savings, weight: WEIGHTS.savings },
    { value: budget, weight: WEIGHTS.budget },
    { value: reserve, weight: WEIGHTS.reserve },
    { value: debt, weight: WEIGHTS.debt },
  ].filter((c): c is { value: number; weight: number } => c.value != null);

  // O componente de dívidas vale 100 por padrão quando não há dívida
  // nenhuma cadastrada — isso é verdade mesmo pra uma conta zerada, então
  // sozinho ele não conta como "sinal real" pra decidir se já dá pra
  // mostrar um score (senão toda conta nova nasceria com 100/100).
  const hasRealSignal = savings != null || budget != null || reserve != null || input.debts.length > 0;

  if (measured.length === 0 || !hasRealSignal) {
    return { score: null, breakdown: { savings, budget, reserve, debt } };
  }

  const totalWeight = measured.reduce((sum, c) => sum + c.weight, 0);
  const weighted = measured.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight;

  return { score: Math.round(weighted), breakdown: { savings, budget, reserve, debt } };
}
