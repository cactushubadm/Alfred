"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/phone";
import Avatar from "@/components/Avatar";
import { PressableButton } from "@/components/motion/Pressable";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

export default function ProfileForm({
  userId,
  email,
  initialName,
  initialPhone,
  initialAvatarUrl,
}: {
  userId: string;
  email: string;
  initialName: string;
  initialPhone: string | null;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { preference, setPreference } = useTheme();

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ? formatPhone(initialPhone) : "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois, se quiser

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Imagem muito grande (máximo 5MB).");
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);

    // Caminho fixo por usuário (sem extensão) — sobrescreve sempre o mesmo
    // arquivo (upsert), então nunca sobra avatar antigo órfão no bucket.
    const path = `${userId}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-busting: a URL pública não muda entre uploads (mesmo caminho),
    // então sem isso o navegador poderia continuar mostrando a foto antiga.
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: bustedUrl })
      .eq("id", userId);

    setUploading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAvatarUrl(bustedUrl);
    router.refresh();
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ name, phone: phone || null })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2.5">
        <Avatar name={name || email} avatarUrl={avatarUrl} size={80} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <PressableButton
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-line-soft px-3.5 py-1.5 text-xs font-medium text-forest disabled:opacity-60 dark:border-text-muted-dark/20 dark:text-sage-mint"
        >
          {uploading ? "Enviando..." : "Trocar foto"}
        </PressableButton>
      </div>

      <div>
        <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Tema</p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <PressableButton
              key={opt.value}
              type="button"
              onClick={() => setPreference(opt.value)}
              className={`flex-1 rounded-full py-2 text-xs font-medium ${
                preference === opt.value
                  ? "bg-forest text-white"
                  : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
              }`}
            >
              {opt.label}
            </PressableButton>
          ))}
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Nome</p>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">E-mail</p>
          <input
            type="email"
            value={email}
            disabled
            readOnly
            className="w-full rounded-card border border-line-soft bg-sage px-3.5 py-2.5 text-sm text-text-muted dark:border-text-muted-dark/20 dark:bg-ink dark:text-text-muted-dark"
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] text-text-muted dark:text-text-muted-dark">Telefone</p>
          <input
            type="tel"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="w-full rounded-card border border-line-soft bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
          />
        </div>

        {error && <p className="text-sm text-wine dark:text-wine-dark">{error}</p>}
        {success && <p className="text-sm text-forest dark:text-sage-mint">Perfil atualizado.</p>}

        <PressableButton
          type="submit"
          disabled={saving}
          className="rounded-full bg-forest py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </PressableButton>
      </form>
    </div>
  );
}
