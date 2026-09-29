import BottomNav from "@/components/BottomNav";
import { SkeletonBlock, SkeletonHeader } from "@/components/Skeleton";

export default function DividasLoading() {
  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <SkeletonHeader eyebrow={false} />

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          <div className="flex flex-col gap-2.5">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>

          <SkeletonBlock className="mt-4 h-11" />

          <SkeletonBlock className="mt-6 h-24" />
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
