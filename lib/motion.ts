// Ritmo das micro-interações do app inteiro — ajustar aqui muda a
// "velocidade" de tudo que usa framer-motion (contagem de números, anéis se
// desenhando, listas em cascata, transição entre telas, feedback de toque).
// Durações em segundos (unidade nativa do framer-motion, não ms).
//
// Conceito "crescimento silencioso": curvas que desaceleram suavemente, sem
// bounce/overshoot — o app nunca "chama atenção", só confirma o que já
// aconteceu.

export const DURATION = {
  tap: 0.15, // feedback ao toque em botões
  fast: 0.2, // itens pequenos, elementos isolados
  base: 0.3, // itens de lista, transição entre telas
  slow: 0.45, // números contando, anéis se desenhando
} as const;

export const EASE = {
  // easeOut suave (expo-like): entra rápido, acomoda devagar — a curva
  // padrão pra quase tudo (contagem, anel, cascata).
  quiet: [0.16, 1, 0.3, 1],
  // easeInOut simétrico — reservado pra transições onde algo sai e entra
  // no mesmo espaço (troca de tela).
  standard: [0.4, 0, 0.2, 1],
} as const;

export const STAGGER = {
  item: 0.045, // atraso entre um item e o próximo numa lista em cascata
  initialDelay: 0.05, // atraso antes do primeiro item começar
} as const;

// Encolhimento sutil ao tocar em botões/links — não é "clicável demais",
// só uma confirmação silenciosa de que o toque registrou.
export const TAP_SCALE = 0.97;

// Entrada padrão de um item de lista: leve fade + slide de baixo pra cima.
export const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.quiet },
  },
} as const;

export const listContainerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: STAGGER.item, delayChildren: STAGGER.initialDelay },
  },
} as const;
