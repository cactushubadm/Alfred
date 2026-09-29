"use client";

import { motion } from "framer-motion";
import { listContainerVariants, listItemVariants } from "@/lib/motion";

// Entrada em cascata pra listas (lançamentos, metas, dívidas, contas a
// pagar, notificações...). `StaggerList` é o container que dispara a
// cascata; cada linha da lista fica dentro de um `StaggerItem`. O
// fade+slide em si (e o corte automático sob prefers-reduced-motion, via
// `MotionConfig reducedMotion="user"` em components/motion/MotionProvider.tsx)
// já vem pronto dos variants centralizados em lib/motion.ts.
export function StaggerList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={listContainerVariants}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div className={className} variants={listItemVariants}>
      {children}
    </motion.div>
  );
}
