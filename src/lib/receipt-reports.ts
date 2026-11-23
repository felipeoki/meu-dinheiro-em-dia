import { inMonth, parcelaLabel, sum, type Account, type Category, type Tx } from './finance';
import { jessicaUpcoming, reimbursementRows } from './outside-accounting';

export interface ReceiptRow {
  id: string; vencimento: string; descricao: string; categoria: string; conta: string; parcela: string;
  valor: number; recebido: boolean; recebidoEm: string | null; observacao: string; quem: string;
}
export interface ReceiptGroup { nome: string; rows: ReceiptRow[]; total: number }
export interface ReceiptTotals { total: number; recebido: number; pendente: number; percentual: number }
export interface ReceiptReport {
  kind: 'reembolsos' | 'jessica'; month: string; totals: ReceiptTotals; groups: ReceiptGroup[];
  pendingOther: ReceiptRow[]; pendingOtherTotal: number; pendingAccumulated: number;
  upcoming: { mes: string; total: number }[];
}
type Input = { txs: Tx[]; month: string; accounts: Pick<Account, 'id' | 'nome'>[]; categories?: Pick<Category, 'id' | 'nome'>[] };
function totals(rows: Tx[]): ReceiptTotals {
  const total = sum(rows), recebido = sum(rows.filter(t => t.recebido));
  return { total, recebido, pendente: sum(rows.filter(t => !t.recebido)), percentual: total > 0 ? recebido / total * 100 : 0 };
}
function build(input: Input, kind: ReceiptReport['kind']): ReceiptReport {
  // Filter ownership before mapping any text: Jessica's document never receives Felipe data.
  const eligible = kind === 'jessica' ? input.txs.filter(t => t.responsavel === 'Jéssica') : reimbursementRows(input.txs);
  const monthly = eligible.filter(t => inMonth(t, input.month));
  const row = (t: Tx): ReceiptRow => ({ id: t.id, vencimento: t.data_vencimento, descricao: t.descricao || 'Sem descrição',
    categoria: input.categories?.find(c => c.id === t.categoria_id)?.nome ?? 'Sem categoria',
    conta: input.accounts.find(a => a.id === t.conta_id)?.nome ?? 'Sem conta',
    parcela: t.recorrencia === 'unica' ? 'Único' : parcelaLabel(t), valor: Number(t.valor), recebido: t.recebido,
    recebidoEm: t.recebido_em, observacao: t.observacoes ?? '', quem: t.reembolso_de?.trim() || 'Não informado' });
  const sort = (a: ReceiptRow, b: ReceiptRow) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao, 'pt-BR') || a.id.localeCompare(b.id);
  const rows = monthly.map(row).sort(sort);
  const key = (r: ReceiptRow) => kind === 'jessica' ? r.conta : r.quem;
  const groups = [...new Set(rows.map(key))].sort((a,b) => a.localeCompare(b,'pt-BR')).map(nome => {
    const items = rows.filter(r => key(r) === nome); return { nome, rows: items, total: sum(items) };
  });
  const pending = eligible.filter(t => !t.recebido && (kind === 'jessica' ? t.data_vencimento.slice(0,7) < input.month : !inMonth(t,input.month)));
  return { kind, month: input.month, totals: totals(monthly), groups, pendingOther: pending.map(row).sort(sort),
    pendingOtherTotal: sum(pending), pendingAccumulated: sum(eligible.filter(t => !t.recebido)),
    upcoming: kind === 'jessica' ? jessicaUpcoming(eligible,input.month) : [] };
}
export const buildReimbursementReport = (input: Input) => build(input, 'reembolsos');
export const buildJessicaReport = (input: Input) => build(input, 'jessica');