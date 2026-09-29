"use client";

import { MotionConfig } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

// `reducedMotion="user"` faz o framer-motion checar sozinho o
// prefers-reduced-motion do sistema e tornar instantâneas as animações de
// transform/layout (whileTap, slide de listas, transição de tela) em vez de
// exigir esse if em cada componente — só o fade de opacidade continua. Para
// as animações que não são transform (contagem de número, anel se
// desenhando via strokeDashoffset), cada componente confere
// `useReducedMotion()` na mão, porque esse mecanismo automático não cobre
// atributos SVG arbitrários.
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE.quiet }}>
      {children}
    </MotionConfig>
  );
}
