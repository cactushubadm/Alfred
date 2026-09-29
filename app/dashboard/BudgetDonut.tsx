import AnimatedNumber from "@/components/motion/AnimatedNumber";
import AnimatedRingReveal from "@/components/motion/AnimatedRingReveal";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";

type Slice = { id: string; name: string; spent: number };
type BudgetAlert = {
  id: string;
  name: string;
  spent: number;
  budget: number;
  pct: number;
};

type Props = {
  slices: Slice[];
  // Total gasto no mês — denominador do anel. O anel é só a distribuição
  // do gasto por categoria (não depende de orçamento; isso fica pra um
  // gráfico futuro separado).
  chartTotal: number;
  alerts: BudgetAlert[];
};

// Só cores já existentes na identidade (forest, amber, forest-light) + os
// 2 tons extras da mesma família definidos em tailwind.config.ts. Wine fica
// de fora de propósito: é a cor reservada para alerta de orçamento, usar
// aqui criaria confusão entre "categoria X" e "categoria estourou o limite".
// forest/forest-light/chart-clay/chart-slate puros reprovam contraste (como
// fatia/traço) sobre surface-dark no escuro — cada um ganha a variante já
// calibrada em tailwind.config.ts (sage-mint/text-muted-dark reaproveitados
// pros 2 verdes, chart-clay-dark/chart-slate-dark novos pros outros 2).
// amber já passa sem ajuste.
const SLICE_STROKE = [
  "stroke-forest dark:stroke-sage-mint",
  "stroke-amber",
  "stroke-forest-light dark:stroke-text-muted-dark",
  "stroke-chart-clay dark:stroke-chart-clay-dark",
  "stroke-chart-slate dark:stroke-chart-slate-dark",
];

const SLICE_BG = [
  "bg-forest dark:bg-sage-mint",
  "bg-amber",
  "bg-forest-light dark:bg-text-muted-dark",
  "bg-chart-clay dark:bg-chart-clay-dark",
  "bg-chart-slate dark:bg-chart-slate-dark",
];

function colorFor(index: number, isOther: boolean, mode: "stroke" | "bg") {
  if (isOther) {
    return mode === "stroke"
      ? "stroke-text-muted dark:stroke-text-muted-dark"
      : "bg-text-muted dark:bg-text-muted-dark";
  }
  const arr = mode === "stroke" ? SLICE_STROKE : SLICE_BG;
  return arr[index % arr.length];
}

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BudgetDonut({ slices, chartTotal, alerts }: Props) {
  const size = 192;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = chartTotal > 0 ? 2 : 0;

  let cumulative = 0;

  return (
    <div className="mt-5 px-5">
      {chartTotal === 0 ? (
        <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
          Nenhum gasto neste mês ainda.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-card bg-white px-4 py-6 dark:bg-surface-dark">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* fundo — só aparece nos pequenos vãos de 2px entre fatias,
                  já que elas sempre somam 100% do total gasto */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                className="stroke-line-soft dark:stroke-text-muted-dark/25"
              />
              <AnimatedRingReveal size={size} radius={radius} strokeWidth={strokeWidth}>
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                  {slices.map((slice, i) => {
                    const fraction = slice.spent / chartTotal;
                    const rawDash = fraction * circumference;
                    const dash = Math.max(rawDash - gap, 0);
                    const strokeDashoffset = -cumulative;
                    cumulative += rawDash;
                    const isOther = slice.id === "outros";

                    return (
                      <circle
                        key={slice.id}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="butt"
                        className={colorFor(i, isOther, "stroke")}
                      />
                    );
                  })}
                </g>
              </AnimatedRingReveal>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
              <p className="whitespace-nowrap text-lg font-medium text-ink dark:text-sage">
                <AnimatedNumber value={chartTotal} format="currency" />
              </p>
              <p className="text-[11px] text-text-muted dark:text-text-muted-dark">gasto no mês</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {slices.map((slice, i) => {
              const isOther = slice.id === "outros";
              return (
                <div key={slice.id} className="flex items-center gap-1.5 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${colorFor(i, isOther, "bg")}`} />
                  <span className="text-ink dark:text-sage">{slice.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <StaggerList className="mt-3 flex flex-col gap-2">
          {alerts.map((a) => {
            const over = a.pct >= 1;
            return (
              <StaggerItem
                key={a.id}
                className={`rounded-card px-3.5 py-2.5 text-xs ${
                  over
                    ? "bg-wine text-white"
                    : "border border-wine text-wine dark:border-wine-dark dark:text-wine-dark"
                }`}
              >
                {over ? "⚠ Orçamento estourado: " : "⚠ Quase no limite: "}
                {a.name} usou {Math.round(a.pct * 100)}% do orçamento (
                {currency(a.spent)} de {currency(a.budget)})
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
  );
}
