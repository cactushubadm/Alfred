import InfoTooltip from "@/components/InfoTooltip";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import AnimatedRingReveal from "@/components/motion/AnimatedRingReveal";
import type { HealthScoreResult } from "@/lib/healthScore";

const COMPONENT_LABEL: Record<keyof HealthScoreResult["breakdown"], string> = {
  savings: "Poupança do mês",
  budget: "Orçamentos",
  reserve: "Reserva de emergência",
  debt: "Dívidas caras",
};

function tierClass(score: number) {
  if (score >= 70) return "stroke-forest dark:stroke-sage-mint";
  if (score >= 40) return "stroke-amber";
  return "stroke-wine dark:stroke-wine-dark";
}

function tierTextClass(score: number) {
  if (score >= 70) return "text-forest dark:text-sage-mint";
  if (score >= 40) return "text-amber";
  return "text-wine dark:text-wine-dark";
}

export default function HealthScoreRing({ result }: { result: HealthScoreResult }) {
  const { score, breakdown } = result;

  const size = 96;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div id="score" className="mx-5 mt-3 flex scroll-mt-6 items-center gap-4 rounded-card bg-white px-4 py-3.5 dark:bg-surface-dark">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-line-soft dark:stroke-text-muted-dark/25"
          />
          {score != null && (
            <AnimatedRingReveal size={size} radius={radius} strokeWidth={strokeWidth}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className={tierClass(score)}
              />
            </AnimatedRingReveal>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            className={`text-xl font-medium ${
              score != null ? tierTextClass(score) : "text-text-muted dark:text-text-muted-dark"
            }`}
          >
            {score != null ? <AnimatedNumber value={score} /> : "—"}
          </p>
          <p className="text-[9px] text-text-muted dark:text-text-muted-dark">/100</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-xs text-text-muted dark:text-text-muted-dark">Score de saúde financeira</p>
          <InfoTooltip message="Média ponderada de 4 fatores: poupança do mês, orçamentos cumpridos, reserva de emergência e ausência de dívidas caras. Fatores sem dado suficiente ficam de fora da conta." />
        </div>
        {score == null ? (
          <p className="mt-1 text-[11px] text-text-muted dark:text-text-muted-dark">
            Ainda não há dados suficientes pra calcular — registre alguns lançamentos primeiro.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-0.5">
            {(Object.keys(breakdown) as (keyof typeof breakdown)[]).map((key) => {
              const value = breakdown[key];
              return (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted dark:text-text-muted-dark">{COMPONENT_LABEL[key]}</span>
                  <span
                    className={
                      value != null
                        ? "text-ink dark:text-sage"
                        : "text-text-muted dark:text-text-muted-dark"
                    }
                  >
                    {value != null ? Math.round(value) : "sem dado"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
