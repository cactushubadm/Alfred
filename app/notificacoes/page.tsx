import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import { getNotifications, type Notification } from "@/lib/notifications";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableLink } from "@/components/motion/Pressable";

// Dados financeiros nunca podem vir de cache — mesma regra do dashboard.
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<Notification["kind"], string> = {
  orcamento: "Orçamento",
  vencimento: "Vencimento",
  meta_em_risco: "Meta",
  divida_cara: "Dívida",
};

export default async function NotificacoesPage() {
  const supabase = createClient();
  const notifications = await getNotifications(supabase);

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 rounded-t-sheet bg-forest px-5 py-4">
          <Link href="/dashboard" aria-label="Fechar" className="text-xl leading-none text-white">
            ×
          </Link>
          <p className="font-display text-lg text-white">Notificações</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {notifications.length === 0 ? (
            <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
              Nenhuma notificação — tudo em dia!
            </p>
          ) : (
            <StaggerList className="flex flex-col gap-2">
              {notifications.map((n) => (
                <StaggerItem key={n.id}>
                  <PressableLink
                    href={n.href}
                    className={`block rounded-card px-3.5 py-3 text-xs ${
                      n.critical
                        ? "bg-wine text-white dark:bg-wine-dark"
                        : "border border-wine text-wine dark:border-wine-dark dark:text-wine-dark"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-medium uppercase tracking-wide ${
                        n.critical ? "text-white/70" : "text-wine/70 dark:text-wine-dark/70"
                      }`}
                    >
                      {KIND_LABEL[n.kind]}
                    </p>
                    <p className="mt-0.5">{n.message}</p>
                  </PressableLink>
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          <p className="mt-4 text-[10px] text-text-muted dark:text-text-muted-dark">
            Geradas automaticamente a cada vez que você abre essa tela, com base nos seus dados
            atuais — orçamento perto do limite, contas e parcelas vencendo em até 3 dias, metas em
            risco no ritmo atual, e dívidas mais caras que seu investimento de longo prazo.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
