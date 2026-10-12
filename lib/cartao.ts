/** Datas civis: nunca converter compras YYYY-MM-DD em instantes UTC. */
export function todaySaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const pad = (n: number) => String(n).padStart(2, '0');
function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function monthAt(year: number, month: number, offset: number) {
  const index = year * 12 + month - 1 + offset;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}
export function cardSchedule(purchaseDate: string | undefined, closingDay: number, dueDay: number, count = 1) {
  const date = purchaseDate || todaySaoPaulo();
  const [year, month, day] = date.split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || year < 1000 || month < 1 || month > 12 || day < 1 || day > lastDay(year, month))
    throw new Error('Data da compra inválida.');
  if (![closingDay, dueDay].every(d => Number.isInteger(d) && d >= 1 && d <= 31))
    throw new Error('Defina o fechamento e o vencimento do cartão em Contas.');
  if (!Number.isInteger(count) || count < 1 || count > 48) throw new Error('Número de parcelas inválido.');
  const firstOffset = day >= Math.min(closingDay, lastDay(year, month)) ? 1 : 0;
  return Array.from({ length: count }, (_, i) => {
    const invoice = monthAt(year, month, firstOffset + i);
    const due = monthAt(invoice.year, invoice.month, dueDay < closingDay ? 1 : 0);
    return {
      invoice_month: `${invoice.year}-${pad(invoice.month)}`,
      due_date: `${due.year}-${pad(due.month)}-${pad(Math.min(dueDay, lastDay(due.year, due.month)))}`,
    };
  });
}
