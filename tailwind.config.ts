import type { Config } from "tailwindcss";

// Tokens de design centralizados aqui. Para trocar a identidade visual
// do app inteiro, basta editar os valores abaixo — os componentes nunca
// devem usar cores "hardcoded" fora deste arquivo.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#1B4332",   // cor primária — estabilidade, marca
        sage: "#F3F6F2",     // fundo claro (modo padrão); também o texto
                             // principal quando usado no modo escuro
        amber: "#C9852E",    // destaques positivos (aportes, metas batidas)
        wine: "#8A1F2B",     // alertas, dívidas, gastos acima do orçamento
        ink: "#0E1512",      // texto principal no claro / fundo no modo escuro
        "forest-light": "#2D5A44",
        "sage-mint": "#C9E5D3",
        "line-soft": "#DCE3D8",
        "text-muted": "#5B6B5F",
        // Únicos 2 tons extras (fora de forest/amber/wine/forest-light)
        // para o gráfico de gastos por categoria, quando 4 fatias não
        // bastam. Mesma família terrosa/baixa saturação da paleta —
        // não usar fora de gráficos.
        "chart-clay": "#8C4530",
        "chart-slate": "#5C7A8A",

        // --- Modo escuro (tokens prontos e já aplicados via `dark:` nos
        // componentes — ver "Identidade visual" no CLAUDE.md) ---
        // `ink` já serve de fundo e `sage` de texto principal, os dois já
        // existentes acima. `forest`/`forest-light` como TEXTO direto sobre
        // `ink`/`surface-dark` reprovam (~1,7:1 / ~2,3:1) — por isso todo
        // `text-forest`/`border-forest` ganha `dark:text-sage-mint` (ou
        // `dark:border-text-muted-dark`), reaproveitando tons já existentes
        // em vez de criar mais um. `forest`/`forest-light` como
        // PREENCHIMENTO (bg + texto sage/branco por cima) continuam ok em
        // qualquer fundo — não precisam de variante. `amber` já passa WCAG
        // AA sobre fundo escuro como está (~6:1 sobre ink, ~5,4:1 sobre
        // surface-dark) — não precisou de variante.
        "surface-dark": "#16211C", // superfície de cards no escuro (ink é só o fundo)
        "text-muted-dark": "#9FB3A6", // texto secundário no escuro — ~8,3:1 (ink) / ~7,5:1 (surface-dark), AA folgado
        "wine-dark": "#DB616F", // wine ajustado pro escuro — ~5,2:1 (ink) / ~4,7:1 (surface-dark); wine puro fica ~2:1/~1,8:1, reprovado em AA
        // chart-clay/chart-slate puros também reprovam como fatia/linha de
        // gráfico sobre surface-dark (~2,4:1/~2,7:1, abaixo do mínimo de
        // 3:1 pra objeto gráfico) — mesmo tratamento do wine-dark: variante
        // calibrada só pro modo escuro, mesmo tom, mais clara.
        "chart-clay-dark": "#C8775F", // ~5,5:1 (ink) / ~4,9:1 (surface-dark)
        "chart-slate-dark": "#8BA4B2", // ~7,1:1 (ink) / ~6,3:1 (surface-dark)
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        sheet: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
