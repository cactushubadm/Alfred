"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

// Faz o "desenho" de um anel/rosca ao carregar — em vez de mexer no dasharray
// de cada fatia (BudgetDonut já usa isso pra desenhar as fatias coloridas),
// aplica uma máscara circular que cresce de 0% a 100% por cima do grupo
// passado em `children`. Assim funciona tanto pra um anel de progresso único
// (HealthScoreRing) quanto pra uma rosca com várias fatias (BudgetDonut),
// sem duplicar o cálculo de cada uma.
//
// Importante: `size`/`radius`/`strokeWidth` devem ser os mesmos usados pelo
// círculo(s) dentro de `children`, senão a máscara não cobre a faixa certa.
export default function AnimatedRingReveal({
  size,
  radius,
  strokeWidth,
  children,
}: {
  size: number;
  radius: number;
  strokeWidth: number;
  children: React.ReactNode;
}) {
  const maskId = useId();
  const prefersReducedMotion = useReducedMotion();
  const circumference = 2 * Math.PI * radius;

  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x={0} y={0} width={size} height={size} fill="black" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={prefersReducedMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.quiet }}
          />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>{children}</g>
    </>
  );
}
