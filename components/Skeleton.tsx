// Blocos de carregamento reaproveitados pelos loading.tsx das rotas
// principais — usam só os tokens de design já existentes (rounded-card,
// bg-line-soft, bg-forest etc.), nunca cor hardcoded.

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-line-soft dark:bg-text-muted-dark/20 ${className}`} />;
}

export function SkeletonHeader({ eyebrow = true }: { eyebrow?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-t-sheet bg-forest px-5 py-4">
      {eyebrow && <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/20" />}
      <div className="h-4 w-36 animate-pulse rounded-full bg-white/30" />
    </div>
  );
}
