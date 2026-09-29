export type AccountType = "corrente" | "poupanca" | "cartao" | "dinheiro";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "dinheiro", label: "Dinheiro" },
];

export function accountTypeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}
