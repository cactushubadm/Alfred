"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/phone";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.6c4.2-3.9 6.8-9.7 6.8-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.1a24 24 0 0 0 0 21.4l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.3-5.6c-2.1 1.4-4.8 2.2-8.2 2.2-6.3 0-11.6-3.6-13.5-8.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setOauthLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // Sem erro, o navegador já está indo pro Google (redirect de página
    // inteira) — não tem o que reabilitar aqui, a tela vai sair do ar.
    if (error) {
      setOauthLoading(false);
      setError(error.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setLoading(false);
        setError(error.message);
        return;
      }

      // O trigger on_auth_user_created (0017_profiles.sql) já criou a linha
      // em profiles com nome provisório (parte local do e-mail) — aqui só
      // completamos com o que foi digitado no cadastro.
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ name: fullName, ...(phone ? { phone } : {}) })
          .eq("id", data.user.id);

        setLoading(false);
        if (profileError) {
          setError(profileError.message);
          return;
        }
      } else {
        setLoading(false);
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sage p-4 dark:bg-ink">
      <div className="w-full max-w-sm rounded-sheet bg-white p-6 shadow-sm dark:bg-surface-dark">
        <p className="font-display text-xl text-forest dark:text-sage-mint">Alfred</p>
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
          {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={oauthLoading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-card border border-line-soft bg-white py-3 text-sm font-medium text-ink disabled:opacity-60 dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
        >
          <GoogleIcon />
          {oauthLoading ? "Redirecionando..." : "Continuar com Google"}
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-line-soft dark:bg-text-muted-dark/20" />
          <p className="text-xs text-text-muted dark:text-text-muted-dark">ou</p>
          <div className="h-px flex-1 bg-line-soft dark:bg-text-muted-dark/20" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nome completo"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
            />
          )}
          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
          {mode === "signup" && (
            <input
              type="tel"
              placeholder="Telefone (opcional)"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
            />
          )}
          <input
            type="password"
            placeholder="Senha"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />

          {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-card bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
              ? "Entrar"
              : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setFullName("");
            setPhone("");
          }}
          className="mt-4 w-full text-center text-xs text-text-muted underline dark:text-text-muted-dark"
        >
          {mode === "login"
            ? "Ainda não tem conta? Criar agora"
            : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
