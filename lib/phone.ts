// Máscara simples de telefone BR enquanto digita: (11) 1234-5678 (fixo,
// 10 dígitos) ou (11) 91234-5678 (celular, 11 dígitos). Compartilhada entre
// o cadastro (app/login/page.tsx) e a edição de perfil (app/perfil).
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
