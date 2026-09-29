import BottomNav from "@/components/BottomNav";
import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function PatrimonioLoading() {
  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <SkeletonHeader eyebrow={false} />

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <SkeletonBlock className="h-20" />

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <SkeletonBlock className="h-28" />
            <SkeletonBlock className="h-28" />
          </div>

          <SkeletonBlock className="mt-4 h-44" />

          <div className="mt-4 flex flex-col gap-2">
            <SkeletonBlock className="h-10" />
            <SkeletonBlock className="h-10" />
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
