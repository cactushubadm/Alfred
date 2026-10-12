import { test } from 'node:test';
import { deepStrictEqual, equal, throws } from 'node:assert/strict';
import { cardSchedule, todaySaoPaulo } from '../lib/cartao.ts';
for (const [name, date, close, due, month, deadline] of [
  ['antes', '2026-10-09', 10, 20, '2026-10', '2026-10-20'],
  ['no fechamento', '2026-10-10', 10, 20, '2026-11', '2026-11-20'],
  ['depois', '2026-10-11', 10, 20, '2026-11', '2026-11-20'],
  ['virada do ano', '2026-12-31', 10, 20, '2027-01', '2027-01-20'],
  ['fechamento curto', '2026-02-28', 31, 31, '2026-03', '2026-03-31'],
  ['antes em fevereiro', '2026-02-27', 31, 31, '2026-02', '2026-02-28'],
  ['vencimento seguinte', '2026-10-09', 10, 5, '2026-10', '2026-11-05'],
  ['bissexto', '2024-02-29', 31, 5, '2024-03', '2024-04-05'],
] as const) test(name, () => deepStrictEqual(cardSchedule(date, close, due)[0], { invoice_month: month, due_date: deadline }));
test('parcelas consecutivas sem deriva de dia', () => deepStrictEqual(cardSchedule('2026-01-01', 10, 31, 3), [
  {invoice_month: '2026-01', due_date: '2026-01-31'},
  {invoice_month: '2026-02', due_date: '2026-02-28'},
  {invoice_month: '2026-03', due_date: '2026-03-31'},
]));
test('noite em São Paulo', () => equal(todaySaoPaulo(new Date('2026-10-13T01:30:00Z')), '2026-10-12'));
test('padrão de hoje e validação', () => {
  deepStrictEqual(cardSchedule(undefined, 10, 20), cardSchedule(todaySaoPaulo(), 10, 20));
  throws(() => cardSchedule('2026-02-30', 10, 20));
  throws(() => cardSchedule('2026-02-01', 0, 20));
});
