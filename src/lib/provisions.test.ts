import { describe, expect, it } from 'vitest';
import { activeProvisionCents, paymentState, provisionCents, provisionEligible, undoPaymentState, validPaymentDate, type Provision } from './provisions';
import type { Tx } from './finance';

const tx: Tx = { id: 't', tipo: 'saida', descricao: 'Teste', valor: 350.23, data_vencimento: '2026-11-20', pago: false, data_pagamento: null, conta_id: null, categoria_id: null, nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null, recorrencia: 'unica', parcela_atual: null, parcelas_total: null, grupo_id: null, ciclo: null, bonificacao: false, encerrada: false, observacoes: null };
const provision = (valor: number): Provision => ({ id: String(valor), user_id: 'u', transaction_id: 't', valor_provisionado: valor, status: 'provisionado', enviado_em: '', pago_em: null, valor_pago: null, observacao: null, transaction: tx });
describe('provisionamento', () => {
  it('soma 350,23 + 120,22 + 170,90 = 641,35', () => {
    expect(activeProvisionCents([provision(350.23), provision(120.22), provision(170.90)])).toBe(64135);
  });
  it('pagar dois deixa somente a terceira provisão', () => {
    expect(activeProvisionCents([paymentState(provision(350.23),350.23,'2026-11-12'), paymentState(provision(120.22),120.22,'2026-11-12'), provision(170.90)])).toBe(17090);
  });
  it('valor pago diferente atualiza somente o lançamento associado', () => {
    const p = paymentState(provision(350.23), 360.125, '2026-11-12');
    expect(p.transaction.valor).toBe(360.125);
    expect(p.transaction.pago).toBe(true);
    expect(p.transaction.data_pagamento).toBe('2026-11-12');
    expect(p.valor_pago).toBe(360.125);
    expect(p.valor_provisionado).toBe(350.23);
    expect(tx.valor).toBe(350.23);
  });
  it('desfazer restaura a provisão e mantém o valor corrigido do boleto', () => {
    const p = undoPaymentState(paymentState(provision(350.23),360,'2026-11-12'));
    expect(activeProvisionCents([p])).toBe(35023);
    expect(p.transaction.pago).toBe(false);
    expect(p.transaction.data_pagamento).toBeNull();
    expect(p.transaction.valor).toBe(360);
    expect(p.valor_pago).toBeNull();
  });
  it('saída pessoal pendente é elegível', () => expect(provisionEligible(tx)).toBe(true));
  it('entrada não é elegível', () => expect(provisionEligible({ ...tx, tipo: 'entrada' })).toBe(false));
  it('paga não é elegível', () => expect(provisionEligible({ ...tx, pago: true })).toBe(false));
  it('não contabilizar não é elegível', () => expect(provisionEligible({ ...tx, nao_contabilizar: true })).toBe(false));
  it('soma três casas exatamente antes de arredondar', () => expect(provisionCents([provision(907.255),provision(49.625)])).toBe(95688));
  it('provisionar sozinho não muda o lançamento', () => expect(provision(100).transaction).toBe(tx));
  it('pagamento não permite data futura', () => expect(validPaymentDate('2026-11-13','2026-11-12')).toBe(false));
  it('pagamento permite hoje', () => expect(validPaymentDate('2026-11-12','2026-11-12')).toBe(true));
});