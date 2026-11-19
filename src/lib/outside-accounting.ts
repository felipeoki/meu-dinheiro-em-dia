import { addMonths, inMonth, isPersonalTransaction, sum, type Tx } from './finance';
export const reimbursementRows = (rows: Tx[]) => rows.filter(t => t.responsavel === 'Felipe' && t.nao_contabilizar);
export const accountingEligible = (t: Tx) => t.tipo === 'saida' && isPersonalTransaction(t);
export const saoPauloToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function validateReceiptDate(date: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) !== date || date > today) throw new Error('Informe uma data válida, sem datas futuras.');
}
export function outsideSummary(rows: Tx[], month: string) {
  const excluded = rows.filter(t => !isPersonalTransaction(t));
  const monthly = excluded.filter(t => inMonth(t, month));
  const group = (items: Tx[]) => ({ total: sum(items), pendente: sum(items.filter(t => !t.recebido)), recebido: sum(items.filter(t => t.recebido)) });
  return { ...group(monthly), reembolsos: group(reimbursementRows(monthly)), jessica: group(monthly.filter(t => t.responsavel === 'Jéssica')), acumulado: sum(excluded.filter(t => !t.recebido)) };
}
export const jessicaUpcoming = (rows: Tx[], month: string) => Array.from({ length: 6 }, (_, i) => { const mes = addMonths(month, i + 1); return { mes, total: sum(rows.filter(t => t.responsavel === 'Jéssica' && inMonth(t, mes))) }; });
