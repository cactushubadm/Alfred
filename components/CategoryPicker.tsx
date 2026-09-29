import { emojiFor } from "@/lib/categoryIcons";

type Category = { id: string; name: string; icon: string };

export default function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-text-muted dark:text-text-muted-dark">Categoria</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`flex w-20 flex-none flex-col items-center gap-1 rounded-card border px-2 py-2.5 text-center dark:bg-surface-dark ${
                selected ? "border-amber bg-white" : "border-line-soft bg-white dark:border-text-muted-dark/20"
              }`}
            >
              <span className="text-xl">{emojiFor(c.icon)}</span>
              <span className="line-clamp-1 text-[11px] text-ink dark:text-sage">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
