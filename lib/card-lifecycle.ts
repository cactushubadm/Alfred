export type CardOpenItem = {
  id: string; kind: 'transaction' | 'installment' | 'pending'; description: string;
  amount: number; due_date: string | null; invoice_month: string | null; installment_number: number | null;
};
export type CardLifecycleSummary = {
  transactionCount: number; installmentCount: number; openItems: CardOpenItem[];
};
export function cardDeletionState(summary: CardLifecycleSummary, today: string) {
  const future = summary.openItems.filter(i => i.kind !== 'pending' && i.due_date != null && i.due_date >= today);
  return {
    canDelete: summary.openItems.length === 0,
    hasHistory: summary.transactionCount > 0 || summary.installmentCount > 0,
    futureCount: future.length,
    futureAmount: future.reduce((sum, i) => sum + Math.round(Number(i.amount) * 100), 0) / 100,
    pendingCount: summary.openItems.length - future.length,
  };
}

// Arquivar pausa novas ocorrências, mas nunca oculta parcelas já assumidas.
export function canRepeatTransaction(row: {
  removed_card?: boolean; removed_transfer_card?: boolean;
  origem?: unknown; destino?: unknown;
}) {
  const origin = row.origem as { archived_at: string | null } | null | undefined;
  const destination = row.destino as { archived_at: string | null } | null | undefined;
  return !row.removed_card && !row.removed_transfer_card && !origin?.archived_at && !destination?.archived_at;
}
