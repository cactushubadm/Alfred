"use client";

import Link, { type LinkProps } from "next/link";
import { motion } from "framer-motion";
import { DURATION, TAP_SCALE } from "@/lib/motion";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

const tap = { scale: TAP_SCALE };
const tapTransition = { duration: DURATION.tap };

// Handlers de animação nativos do DOM (onAnimationStart/onDrag...) colidem
// de tipo com os do framer-motion (que reaproveita esses nomes de evento
// pra outra coisa) — de fora pra não vazar esse conflito pra quem usa os
// componentes.
type NativeAnimationHandlers =
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd";

// Feedback de toque padrão (encolhe sutilmente) pros botões/links mais
// tocados do app. `MotionConfig reducedMotion="user"` (MotionProvider)
// já torna isso instantâneo sob prefers-reduced-motion, então não precisa
// de tratamento extra aqui.
export function PressableButton({
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, NativeAnimationHandlers>) {
  return (
    <motion.button
      whileTap={tap}
      transition={tapTransition}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

const MotionLink = motion(Link);

export function PressableLink({
  className,
  children,
  ...props
}: LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, NativeAnimationHandlers | keyof LinkProps> & {
    children?: React.ReactNode;
  }) {
  return (
    <MotionLink whileTap={tap} transition={tapTransition} className={className} {...props}>
      {children}
    </MotionLink>
  );
}
