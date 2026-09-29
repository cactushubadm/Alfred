"use client";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Excluir",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-xs rounded-sheet bg-white p-5 dark:bg-surface-dark">
        <p className="font-display text-base text-ink dark:text-sage">{title}</p>
        <p className="mt-1.5 text-sm text-text-muted dark:text-text-muted-dark">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-full border border-line-soft py-2.5 text-sm font-medium text-text-muted disabled:opacity-60 dark:border-text-muted-dark/20 dark:text-text-muted-dark"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full bg-wine py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Excluindo..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
