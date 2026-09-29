import BottomNav from "@/components/BottomNav";
import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function FluxoDeCaixaLoading() {
  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <SkeletonHeader eyebrow={false} />

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="grid grid-cols-3 gap-2">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
          </div>

          <SkeletonBlock className="mt-3 h-8" />

          <div className="mt-5 flex flex-col gap-2">
            <SkeletonBlock className="h-14" />
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
