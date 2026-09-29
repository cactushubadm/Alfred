import BottomNav from "@/components/BottomNav";
import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <SkeletonHeader />

        <div className="rounded-b-sheet bg-sage pb-6 dark:bg-ink">
          {/* Anel do score */}
          <div className="mx-5 mt-3 flex items-center gap-4 rounded-card bg-white px-4 py-3.5 dark:bg-surface-dark">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-line-soft dark:bg-text-muted-dark/20" />
            <div className="flex-1">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="mt-2 h-3 w-full" />
              <SkeletonBlock className="mt-1.5 h-3 w-full" />
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-2.5 px-5 pt-5">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
          </div>

          {/* Sobra do mês */}
          <SkeletonBlock className="mx-5 mt-3 h-20" />

          {/* Links de entrada */}
          <div className="mx-5 mt-2 flex flex-col gap-2">
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
          </div>

          {/* Anel de gastos */}
          <div className="mt-5 flex justify-center px-5">
            <div className="h-48 w-48 animate-pulse rounded-full bg-line-soft dark:bg-text-muted-dark/20" />
          </div>

          {/* Lançamentos recentes */}
          <div className="mt-5 flex flex-col gap-2 px-5">
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
