"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

type NumberFormat = "currency" | "integer";

function formatValue(v: number, format: NumberFormat) {
  return format === "currency"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : Math.round(v).toLocaleString("pt-BR");
}

// Conta de 0 (ou do valor anterior, se já tinha montado) até `value` — os
// "valores monetários principais" do produto (saldo, recebido, gasto,
// centro dos anéis) usam isso em vez de aparecer prontos, reforçando a
// ideia de "crescimento" a cada carregamento. Atualiza o texto via
// MotionValue (sem re-renderizar o componente a cada frame).
//
// `format` é uma string (não uma função) de propósito: isso é renderizado
// por telas Server Component, e passar uma função como prop pra um Client
// Component quebra a serialização do React Server Components.
export default function AnimatedNumber({
  value,
  format = "integer",
  className,
}: {
  value: number;
  format?: NumberFormat;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const hasMountedRef = useRef(false);
  const rendered = useTransform(motionValue, (v) => formatValue(v, format));

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.jump(value);
      return;
    }

    const from = hasMountedRef.current ? motionValue.get() : 0;
    hasMountedRef.current = true;

    const controls = animate(from, value, {
      duration: DURATION.slow,
      ease: EASE.quiet,
      onUpdate: (v) => motionValue.set(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  return <motion.span className={className}>{rendered}</motion.span>;
}
