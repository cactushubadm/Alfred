"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

// Sete atalhos de criação — o "+" central abre esse leque em cascata.
// `?new=1` e `?type=` fazem a tela de destino já abrir direto no modo de
// criação, em vez de exigir mais um toque.
const CREATE_ITEMS = [
  { label: "Nova despesa", href: "/lancamentos/novo?type=despesa" },
  { label: "Nova receita", href: "/lancamentos/novo?type=receita" },
  { label: "Transferência", href: "/lancamentos/novo?type=transferencia" },
  { label: "Nova meta", href: "/metas?new=1" },
  { label: "Nova dívida", href: "/dividas?new=1" },
  { label: "Compra planejada", href: "/estimativa-de-compra?new=1" },
  { label: "Nova conta/cartão", href: "/contas?new=1" },
];

// Nove telas de consulta — o botão de menu abre esse painel.
const CONSULTA_ITEMS = [
  { label: "Simulador de investimento", href: "/investimentos" },
  { label: "Calculadora de aposentadoria", href: "/aposentadoria" },
  { label: "Dívidas", href: "/dividas" },
  { label: "Patrimônio líquido", href: "/patrimonio" },
  { label: "Fluxo de caixa", href: "/fluxo-de-caixa" },
  { label: "Contas a pagar/receber", href: "/contas-a-pagar" },
  { label: "Relatórios", href: "/relatorios" },
  { label: "Categorias", href: "/categorias" },
  { label: "Score de saúde financeira", href: "/dashboard#score" },
];

type Panel = "create" | "menu" | null;

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  const [openPanel, setOpenPanel] = useState<Panel>(null);
  // Flipado um tick depois de montar, pra a transição de entrada partir de
  // um estado "fechado" real em vez de já nascer aberta (sem isso não tem
  // o que animar). Fechar não anima — some junto com o desmonte.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!openPanel) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [openPanel]);

  function toggle(panel: Panel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  const tabClass = (href: string) =>
    `flex flex-col items-center gap-0.5 ${
      isActive(href) ? "text-forest dark:text-sage-mint" : "text-text-muted dark:text-text-muted-dark"
    }`;

  return (
    <>
      {openPanel && (
        <div
          className="fixed inset-0 z-40 bg-ink/30"
          aria-hidden="true"
          onClick={() => setOpenPanel(null)}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[45] flex justify-center">
        <div className="relative flex w-full max-w-sm items-center justify-between border-t border-line-soft bg-white px-8 py-3 dark:border-text-muted-dark/20 dark:bg-surface-dark">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className={tabClass("/dashboard")} aria-label="Início">
              <HomeIcon />
            </Link>
            <button
              type="button"
              onClick={() => toggle("menu")}
              aria-label="Menu de consulta"
              aria-expanded={openPanel === "menu"}
              className={`flex flex-col items-center gap-0.5 ${
                openPanel === "menu"
                  ? "text-forest dark:text-sage-mint"
                  : "text-text-muted dark:text-text-muted-dark"
              }`}
            >
              <MenuIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggle("create")}
            aria-label={openPanel === "create" ? "Fechar" : "Criar novo"}
            aria-expanded={openPanel === "create"}
            className="absolute left-1/2 top-0 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-2xl font-medium leading-none text-white transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `translate(-50%, -50%) rotate(${openPanel === "create" ? 45 : 0}deg)` }}
          >
            +
          </button>

          {/* Leque de criação, em cascata a partir do "+" */}
          {openPanel === "create" && (
            <div className="absolute bottom-full left-1/2 mb-4 grid w-64 -translate-x-1/2 grid-cols-2 gap-2">
              {CREATE_ITEMS.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenPanel(null)}
                  className={`rounded-card bg-white px-3 py-2.5 text-center text-[11px] font-medium text-ink shadow-sm ring-1 ring-line-soft transition-all duration-200 motion-reduce:transition-none motion-reduce:duration-0 dark:bg-surface-dark dark:text-sage dark:ring-text-muted-dark/20 ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  }`}
                  style={{ transitionDelay: visible ? `${i * 35}ms` : "0ms" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          <Link href="/perfil" className={tabClass("/perfil")} aria-label="Perfil">
            <UserIcon />
          </Link>
        </div>
      </nav>

      {/* Painel de consulta, subindo como uma folha do rodapé */}
      {openPanel === "menu" && (
        <div
          className={`fixed inset-x-0 bottom-0 z-[45] flex justify-center transition-transform duration-300 motion-reduce:transition-none motion-reduce:duration-0 ${
            visible ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="w-full max-w-sm rounded-t-sheet bg-white p-5 pb-8 dark:bg-surface-dark">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-soft dark:bg-text-muted-dark/30" />
            <p className="mb-3 font-display text-base text-ink dark:text-sage">Consultar</p>
            <div className="flex flex-col gap-2">
              {CONSULTA_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenPanel(null)}
                  className="rounded-card border border-line-soft px-3.5 py-2.5 text-sm font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
