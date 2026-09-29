"use client";

import { useState } from "react";

export default function InfoTooltip({ message }: { message: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Mais informações"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold leading-none text-white"
      >
        !
      </button>
      <span
        className={`absolute bottom-full right-0 z-10 mb-2 w-48 rounded-card bg-ink px-3 py-2 text-left text-[11px] leading-snug text-white dark:bg-forest-light dark:text-sage ${
          open ? "block" : "hidden group-hover:block"
        }`}
      >
        {message}
      </span>
    </span>
  );
}
