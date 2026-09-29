import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Pra onde o Google (ou qualquer provider OAuth) redireciona de volta com o
// `code` — troca esse código pela sessão (grava os cookies via
// lib/supabase/server.ts) e manda pro dashboard, igual já acontece no login
// por e-mail/senha. O trigger on_auth_user_created (0017_profiles.sql) cuida
// de criar a linha em profiles com nome/avatar vindos do Google.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
