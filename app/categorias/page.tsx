"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ICON_OPTIONS, emojiFor } from "@/lib/categoryIcons";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import { PressableButton } from "@/components/motion/Pressable";

type CategoryType = "despesa" | "receita";

type Category = {
  id: string;
  name: string;
  icon: string;
  type: CategoryType;
  monthly_budget: number | null;
};

function parseBudget(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CategoriasPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeType, setActiveType] = useState<CategoryType>("despesa");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("dots-circle-horizontal");
  const [editBudget, setEditBudget] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("dots-circle-horizontal");
  const [newBudget, setNewBudget] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon, type, monthly_budget")
      .order("name");

    if (error) {
      setError(error.message);
    } else {
      setCategories(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const visible = categories.filter((c) => c.type === activeType);

  function selectType(type: CategoryType) {
    setActiveType(type);
    setEditingId(null);
    setShowNewForm(false);
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditBudget(cat.monthly_budget != null ? Number(cat.monthly_budget).toFixed(2) : "");
    setShowNewForm(false);
  }

  async function handleUpdate(id: string) {
    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .update({
        name: editName,
        icon: editIcon,
        monthly_budget: activeType === "despesa" ? parseBudget(editBudget) : null,
      })
      .eq("id", id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    loadCategories();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    setDeleting(true);
    const { error } = await supabase.from("categories").delete().eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setPendingDelete(null);
    loadCategories();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada, faça login novamente.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: newName,
      icon: newIcon,
      type: activeType,
      monthly_budget: activeType === "despesa" ? parseBudget(newBudget) : null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNewName("");
    setNewIcon("dots-circle-horizontal");
    setNewBudget("");
    setShowNewForm(false);
    loadCategories();
  }

  return (
    <main className="flex min-h-screen justify-center bg-sage p-4 pb-24 dark:bg-ink">
      <div className="w-full max-w-sm">
        <div className="rounded-t-sheet bg-forest px-5 py-4">
          <p className="font-display text-lg text-white">Categorias</p>
        </div>

        <div className="rounded-b-sheet bg-sage pb-6 dark:bg-ink">
          <div className="flex gap-2 px-5 pt-5">
            <PressableButton
              type="button"
              onClick={() => selectType("despesa")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                activeType === "despesa"
                  ? "bg-wine text-white"
                  : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
              }`}
            >
              Despesas
            </PressableButton>
            <PressableButton
              type="button"
              onClick={() => selectType("receita")}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium ${
                activeType === "receita"
                  ? "bg-forest text-white"
                  : "border border-line-soft text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
              }`}
            >
              Receitas
            </PressableButton>
          </div>

          {error && <p className="mt-3 px-5 text-sm text-wine dark:text-wine-dark">{error}</p>}

          <div className="mt-4 flex flex-col gap-2 px-5">
            {loading ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Carregando...
              </p>
            ) : visible.length === 0 ? (
              <p className="rounded-card bg-white px-3.5 py-4 text-center text-sm text-text-muted dark:bg-surface-dark dark:text-text-muted-dark">
                Nenhuma categoria ainda.
              </p>
            ) : (
              <StaggerList key={activeType} className="flex flex-col gap-2">
                {visible.map((cat) => {
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <StaggerItem key={cat.id} className="flex flex-col gap-2 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark">
                      <div className="flex gap-2">
                        <select
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="w-16 shrink-0 rounded-card border border-line-soft bg-white px-1.5 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                        >
                          {ICON_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.emoji} {opt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="min-w-0 flex-1 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                        />
                      </div>
                      {activeType === "despesa" && (
                        <MoneyInput
                          placeholder="Orçamento mensal (opcional)"
                          value={editBudget}
                          onChange={setEditBudget}
                          className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                        />
                      )}
                      <div className="flex gap-2">
                        <PressableButton
                          type="button"
                          onClick={() => handleUpdate(cat.id)}
                          disabled={saving}
                          className="flex-1 rounded-card bg-forest py-2 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Salvar
                        </PressableButton>
                        <PressableButton
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex-1 rounded-card border border-line-soft py-2 text-xs font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                        >
                          Cancelar
                        </PressableButton>
                      </div>
                    </StaggerItem>
                  );
                }

                return (
                  <StaggerItem
                    key={cat.id}
                    className="flex items-center justify-between rounded-card bg-white px-3.5 py-2.5 dark:bg-surface-dark"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{emojiFor(cat.icon)}</span>
                      <div>
                        <p className="text-sm text-ink dark:text-sage">{cat.name}</p>
                        {cat.type === "despesa" && (
                          <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                            {cat.monthly_budget != null
                              ? `Orçamento: ${cat.monthly_budget.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}`
                              : "Sem orçamento definido"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <PressableButton
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="rounded-full border border-line-soft px-3 py-1 text-[11px] font-medium text-forest dark:border-text-muted-dark/20 dark:text-sage-mint"
                      >
                        Editar
                      </PressableButton>
                      <PressableButton
                        type="button"
                        onClick={() => setPendingDelete(cat)}
                        className="rounded-full border border-wine px-3 py-1 text-[11px] font-medium text-wine dark:border-wine-dark dark:text-wine-dark"
                      >
                        Excluir
                      </PressableButton>
                    </div>
                  </StaggerItem>
                );
                })}
              </StaggerList>
            )}
          </div>

          <div className="mt-4 px-5">
            {showNewForm ? (
              <form
                onSubmit={handleCreate}
                className="flex flex-col gap-2 rounded-card bg-white px-3.5 py-3 dark:bg-surface-dark"
              >
                <div className="flex gap-2">
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-16 shrink-0 rounded-card border border-line-soft bg-white px-1.5 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Nome da categoria"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="min-w-0 flex-1 rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                  />
                </div>
                {activeType === "despesa" && (
                  <MoneyInput
                    placeholder="Orçamento mensal (opcional)"
                    value={newBudget}
                    onChange={setNewBudget}
                    className="rounded-card border border-line-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest dark:border-text-muted-dark/20 dark:bg-surface-dark dark:text-sage"
                  />
                )}
                <div className="flex gap-2">
                  <PressableButton
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-full bg-forest py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Criar categoria"}
                  </PressableButton>
                  <PressableButton
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="flex-1 rounded-full border border-line-soft py-2.5 text-sm font-medium text-text-muted dark:border-text-muted-dark/20 dark:text-text-muted-dark"
                  >
                    Cancelar
                  </PressableButton>
                </div>
              </form>
            ) : (
              <PressableButton
                type="button"
                onClick={() => {
                  setShowNewForm(true);
                  setEditingId(null);
                }}
                className="block w-full rounded-full border border-forest py-3 text-center text-sm font-medium text-forest dark:border-text-muted-dark/30 dark:text-sage-mint"
              >
                + Nova categoria
              </PressableButton>
            )}
          </div>
        </div>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir categoria"
        message={`Tem certeza que quer excluir "${pendingDelete?.name}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
