import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita —
            // ok ignorar, pois o middleware já cuida de renovar a sessão
          }
        },
      },
      global: {
        // O Next.js coloca todo `fetch()` em cache por padrão, mesmo dentro
        // de Server Components renderizados por request — sem isso, o
        // dashboard pode continuar mostrando uma resposta antiga do Supabase
        // (dados financeiros nunca podem vir de cache).
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
