import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import MotionProvider from "@/components/motion/MotionProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Alfred",
  description: "Controle financeiro e planejamento de investimentos",
};

// Roda antes do React hidratar, direto no <head> — decide a classe "dark"
// já no primeiro paint (localStorage, com fallback pro tema do SO quando a
// preferência é "system") pra nunca piscar do claro pro escuro depois que
// o ThemeProvider (components/theme/ThemeProvider.tsx) montar. A chave
// "theme-preference" precisa bater com a mesma constante de lá.
const themeInitScript = `
(function () {
  try {
    var pref = localStorage.getItem("theme-preference") || "system";
    var isDark =
      pref === "dark" ||
      (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} font-sans`}>
        <ThemeProvider>
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
