import BottomNav from "@/components/BottomNav";
import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function RelatoriosLoading() {
  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <SkeletonHeader eyebrow={false} />

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock className="h-8 w-20" />
            <SkeletonBlock className="h-8 w-28" />
            <SkeletonBlock className="h-8 w-20" />
          </div>

          <SkeletonBlock className="mx-auto mt-4 h-5 w-32" />

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
          </div>

          <SkeletonBlock className="mt-2.5 h-20" />
          <SkeletonBlock className="mt-2.5 h-16" />
          <SkeletonBlock className="mt-2.5 h-12" />
          <SkeletonBlock className="mt-2.5 h-28" />
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
