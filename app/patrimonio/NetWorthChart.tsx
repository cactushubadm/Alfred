"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function monthLabel(monthDate: string) {
  const [y, m] = monthDate.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// Cada barra cresce de 0 até a altura final ao carregar — mesma ideia de
// "crescimento" dos anéis/números, só que aplicada ao gráfico de evolução
// do patrimônio.
export default function NetWorthChart({
  data,
}: {
  data: { monthDate: string; netWorth: number; estimated: boolean }[];
}) {
  const prefersReducedMotion = useReducedMotion();
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.netWorth)), 1);
  const hasEstimated = data.some((d) => d.estimated);

  return (
    <div className="rounded-card bg-white p-4 dark:bg-surface-dark">
      <p className="mb-3 text-xs text-text-muted dark:text-text-muted-dark">Evolução mês a mês</p>
      <div className="flex h-36 items-end gap-1">
        {data.map((d, i) => {
          const heightPct = Math.max((Math.abs(d.netWorth) / maxAbs) * 100, 2);
          return (
            <div
              key={d.monthDate}
              className="flex h-full min-w-[6px] flex-1 flex-col items-end justify-end"
              title={`${monthLabel(d.monthDate)}: ${currency(d.netWorth)}${
                d.estimated ? " (estimado, sem visita nesse mês)" : ""
              }`}
            >
              <motion.div
                className={`w-full rounded-t-sm ${
                  d.netWorth >= 0 ? "bg-forest dark:bg-sage-mint" : "bg-wine dark:bg-wine-dark"
                } ${d.estimated ? "opacity-35" : ""}`}
                initial={prefersReducedMotion ? false : { height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{
                  duration: DURATION.slow,
                  ease: EASE.quiet,
                  delay: prefersReducedMotion ? 0 : i * STAGGER.item,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <span
            key={d.monthDate}
            className="min-w-[6px] flex-1 text-center text-[9px] text-text-muted dark:text-text-muted-dark"
          >
            {i % Math.max(Math.ceil(data.length / 6), 1) === 0 || i === data.length - 1
              ? monthLabel(d.monthDate)
              : ""}
          </span>
        ))}
      </div>
      {hasEstimated && (
        <p className="mt-2 text-[10px] text-text-muted dark:text-text-muted-dark">
          <span className="inline-block h-2 w-2 rounded-sm bg-forest opacity-35 align-[-1px] dark:bg-sage-mint" />{" "}
          barra mais clara = mês estimado (repetido do último valor calculado, sem visita nesse
          mês)
        </p>
      )}
    </div>
  );
}
