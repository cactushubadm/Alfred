export const ICON_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: "wallet", emoji: "💼", label: "Carteira" },
  { value: "briefcase", emoji: "💼", label: "Trabalho" },
  { value: "plus-circle", emoji: "➕", label: "Outros recebimentos" },
  { value: "shopping-cart", emoji: "🛒", label: "Mercado" },
  { value: "home", emoji: "🏠", label: "Casa" },
  { value: "car", emoji: "🚗", label: "Transporte" },
  { value: "tools-kitchen-2", emoji: "🍽️", label: "Restaurante" },
  { value: "heart", emoji: "❤️", label: "Saúde" },
  { value: "device-gamepad-2", emoji: "🎮", label: "Lazer" },
  { value: "refresh", emoji: "🔁", label: "Assinaturas" },
  { value: "book", emoji: "📚", label: "Educação" },
  { value: "gift", emoji: "🎁", label: "Presentes" },
  { value: "plane", emoji: "✈️", label: "Viagem" },
  { value: "paw", emoji: "🐾", label: "Pet" },
  { value: "dots-circle-horizontal", emoji: "⚪", label: "Outros" },
];

export function emojiFor(icon: string) {
  return ICON_OPTIONS.find((opt) => opt.value === icon)?.emoji ?? "⚪";
}
