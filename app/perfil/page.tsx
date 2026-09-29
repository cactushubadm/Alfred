import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Normalmente sempre existe (trigger on_auth_user_created cria a linha no
  // cadastro), mas conta criada antes da migration 0017 só ganha uma depois
  // do backfill de 0019_profiles_backfill.sql — até isso rodar, cai num
  // fallback com os mesmos dados que o trigger usaria.
  const { data: profile } = user
    ? await supabase.from("profiles").select("name, phone, avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  const fallbackName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="rounded-t-sheet bg-forest px-5 py-4">
          <p className="font-display text-lg text-white">Perfil</p>
        </div>

        <div className="rounded-b-sheet bg-sage px-5 pb-6 pt-5 dark:bg-ink">
          {user && (
            <ProfileForm
              userId={user.id}
              email={user.email ?? ""}
              initialName={profile?.name ?? fallbackName}
              initialPhone={profile?.phone ?? null}
              initialAvatarUrl={profile?.avatar_url ?? null}
            />
          )}

          <form action="/auth/signout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full rounded-full border border-wine py-3 text-sm font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
            >
              Sair
            </button>
          </form>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
