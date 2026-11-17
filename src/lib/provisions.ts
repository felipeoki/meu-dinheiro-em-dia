import { isPersonalTransaction, type Tx } from './finance';
import { selectionSummary } from './transaction-selection';

export type Provision = {
  id: string; user_id: string; transaction_id: string; valor_provisionado: number;
  status: 'provisionado' | 'pago'; enviado_em: string; pago_em: string | null;
  valor_pago: number | null; observacao: string | null; transaction: Tx;
};
export const provisionEligible = (t: Pick<Tx, 'tipo' | 'pago' | 'nao_contabilizar' | 'responsavel'>) => t.tipo === 'saida' && !t.pago && isPersonalTransaction(t);
export const provisionCents = (rows: Pick<Provision, 'valor_provisionado'>[]) => selectionSummary(rows.map(p => ({ tipo: 'saida', valor: p.valor_provisionado }))).totalCentavos;
export const activeProvisionCents = (rows: Pick<Provision, 'valor_provisionado' | 'status'>[]) => provisionCents(rows.filter(p => p.status === 'provisionado'));
export function paymentState(p: Provision, value: number, date: string): Provision {
  return { ...p, status: 'pago', pago_em: date, valor_pago: value, transaction: { ...p.transaction, pago: true, valor: value, data_pagamento: date } };
}
export function undoPaymentState(p: Provision): Provision {
  return { ...p, status: 'provisionado', pago_em: null, valor_pago: null, transaction: { ...p.transaction, pago: false, data_pagamento: null } };
}
export function validPaymentDate(date: string, today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date <= today;
}