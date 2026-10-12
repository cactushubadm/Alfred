import { test } from 'node:test';
import { deepStrictEqual, equal } from 'node:assert/strict';
import { cardDeletionState, canRepeatTransaction, type CardLifecycleSummary } from '../lib/card-lifecycle.ts';
const summary = (overrides: Partial<CardLifecycleSummary> = {}): CardLifecycleSummary => ({transactionCount: 0, installmentCount: 0, openItems: [], ...overrides});
test('cartão vazio permite excluir', () => deepStrictEqual(cardDeletionState(summary(), '2026-10-12'), {
  canDelete: true, hasHistory: false, futureCount: 0, futureAmount: 0, pendingCount: 0,
}));
test('histórico quitado permite arquivar ou excluir', () => {
  const result = cardDeletionState(summary({transactionCount: 3, installmentCount: 2}), '2026-10-12');
  equal(result.hasHistory, true); equal(result.canDelete, true);
});
test('primeira parcela e parcelas seguintes bloqueiam e somam centavos', () => {
  const result = cardDeletionState(summary({transactionCount: 1, installmentCount: 1, openItems: [
    {id: '1', kind: 'transaction', description: 'Compra', amount: 10.01, due_date: '2026-10-12', invoice_month: '2026-10', installment_number: 1},
    {id: '2', kind: 'installment', description: 'Compra', amount: 20.02, due_date: '2026-11-12', invoice_month: '2026-11', installment_number: 2},
  ]}), '2026-10-12');
  equal(result.canDelete, false); equal(result.futureCount, 2); equal(result.futureAmount, 30.03);
});
test('vencimento passado ou desconhecido nunca comprova quitação', () => {
  for (const due_date of [null, '2026-01-01']) {
    const result = cardDeletionState(summary({transactionCount: 1, openItems: [
      {id: '1', kind: 'transaction', description: 'Compra', amount: 100, due_date, invoice_month: null, installment_number: 1},
    ]}), '2026-10-12');
    equal(result.canDelete, false); equal(result.pendingCount, 1); equal(result.futureCount, 0);
  }
});

test('arquivar ou remover pausa novas recorrências sem impedir contas comuns', () => {
  equal(canRepeatTransaction({}), true);
  equal(canRepeatTransaction({origem: {archived_at: null}}), true);
  equal(canRepeatTransaction({origem: {archived_at: '2026-10-12'}}), false);
  equal(canRepeatTransaction({destino: {archived_at: '2026-10-12'}}), false);
  equal(canRepeatTransaction({removed_card: true}), false);
  equal(canRepeatTransaction({removed_transfer_card: true}), false);
});
