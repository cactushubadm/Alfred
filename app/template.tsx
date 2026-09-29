"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

// Transição entre telas do App Router: `template.tsx` remonta a cada
// navegação, então o fade "reinicia" naturalmente sem precisar de
// AnimatePresence (que exigiria manter a tela antiga montada durante a
// saída — mais custoso e sem necessidade aqui, já que as durações são
// curtas o bastante pra não caber uma troca cross-fade real).
//
// De propósito só anima opacity, nunca x/y/scale: como cada page.tsx
// renderiza seu próprio <BottomNav /> com position fixed, qualquer
// transform aplicado num ancestral (mesmo que temporário, só durante a
// animação) vira containing block e quebra esse fixed até a transição
// terminar. Fade puro não tem esse problema.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.standard }}
    >
      {children}
    </motion.div>
  );
}
