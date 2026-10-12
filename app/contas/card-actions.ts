"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CardLifecycleSummary } from "@/lib/card-lifecycle";

export async function manageCard(input: {
  id: string; action: "inspect" | "archive" | "restore" | "delete" | "pay";
  name?: string; itemId?: string; kind?: string;
}): Promise<{ data?: CardLifecycleSummary; error?: string }> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  const { data: card, error: lookupError } = await db.from("accounts")
    .select("id").eq("id", input.id).eq("user_id", user.id).eq("type", "cartao").maybeSingle();
  if (lookupError || !card) return { error: "Cartão não encontrado." };
  const { data, error } = await db.rpc("card_lifecycle", {
    p_card_id: input.id, p_action: input.action, p_name: input.name ?? null,
    p_item_id: input.itemId ?? null, p_kind: input.kind ?? null,
  });
  if (error) return { error: error.message };
  if (input.action !== "inspect") {
    for (const path of ["/contas", `/cartoes/${input.id}`, "/dashboard", "/fluxo-de-caixa", "/patrimonio", "/relatorios", "/notificacoes", "/contas-a-pagar"])
      revalidatePath(path);
  }
  return { data: data as CardLifecycleSummary };
}
