import { describe, expect, it } from 'vitest';
import { annualRows, cdiIsStale, effectiveRate, monthlyRate, parseBcbRate, simulateInvestment } from './investments';

const base = { valor_inicial: 100, aporte_mensal: 250, data_inicio: '2022-10-01', capitalizacao: 'nominal' as const };
describe('spreadsheet-compatible investments', () => {
  const months = simulateInvestment(base, 12, 30);
  it.each([['2022-10', 100], ['2022-11', 353.5], ['2022-12', 609.535], ['2023-01', 868.13], ['2023-12', 3889.17], ['2045-12', 377763.76]] as const)('matches %s balance %s', (mes, value) => {
    expect(months.find(m => m.mes === mes)?.saldo).toBeCloseTo(value, mes === '2022-12' ? 3 : 2);
  });
  it('start month has no contribution or yield', () => {
    expect(months[0]).toEqual({ mes: '2022-10', saldo: 100, aportado: 100, rendimento: 0 });
  });
  it('contribution enters before interest without intermediate rounding', () => {
    expect(months[2]?.saldo).toBe(609.535);
    expect(months[3]?.saldo).toBeCloseTo(868.13035, 8);
  });
  it('real contributed capital includes initial value and 278 contributions', () => {
    const row = months.find(m => m.mes === '2045-12');
    expect(row?.aportado).toBe(69600);
    expect(row?.rendimento).toBeCloseTo(308163.760779, 5);
  });
  it('annual income uses December balance times annual decimal rate', () => {
    const row = annualRows(months, 12).find(r => r.ano === '2023');
    expect(row?.rendaAno).toBeCloseTo(3889.171305573726 * 0.12, 8);
    expect(row?.rendaMes).toBeCloseTo(3889.171305573726 * 0.12 / 12, 8);
  });
  it('compound monthly rate is equivalent to annual rate', () => {
    expect((1 + monthlyRate(12, 'composta')) ** 12 - 1).toBeCloseTo(0.12, 10);
    expect(monthlyRate(12, 'nominal')).toBe(0.01);
  });
  it('horizon contains exactly years times 12 months including start', () => {
    expect(simulateInvestment(base, 12, 5)).toHaveLength(60);
    expect(simulateInvestment(base, 12, 5).at(-1)?.mes).toBe('2027-09');
  });
  it('what-if calculation does not modify investment inputs', () => {
    simulateInvestment({ ...base, aporte_mensal: 500 }, 20, 10);
    expect(base.aporte_mensal).toBe(250);
  });
});
describe('CDI rules', () => {
  const rate = { taxa_anual: 14.9, referencia: '2026-11-06', fonte: 'BCB', atualizado_em: '2026-11-09T00:00:00Z' };
  it('CDI 110% follows latest global CDI rather than storing an effective rate', () => {
    const investment = { tipo_taxa: 'cdi' as const, taxa_anual: null, percentual_cdi: 110 };
    expect(effectiveRate(investment, 14.9)).toBeCloseTo(16.39, 8);
    expect(effectiveRate(investment, 13)).toBe(14.3);
    expect(effectiveRate(investment, null)).toBeNull();
  });
  it('SGS 4389 validates and converts reference date', () => {
    expect(parseBcbRate([{ data: '06/11/2026', valor: '14.90' }])).toEqual({ taxa_anual: 14.9, referencia: '2026-11-06', fonte: 'BCB SGS 4389 · CDI base 252' });
  });
  it('fallback Selic deducts 0.10 percentage point', () => {
    expect(parseBcbRate([{ data: '06/11/2026', valor: '15.00' }], true)?.taxa_anual).toBe(14.9);
  });
  it.each(['NaN', '', '101', '-1', 'Infinity', '14.9junk'])('rejects invalid rate %s', valor => {
    expect(parseBcbRate([{ data: '06/11/2026', valor }])).toBeNull();
  });
  it('rejects invalid reference dates', () => {
    expect(parseBcbRate([{ data: '31/02/2026', valor: '14.90' }])).toBeNull();
  });
  it('refreshes only after more than 12 hours or when no rate exists', () => {
    expect(cdiIsStale(rate, Date.parse('2026-11-09T12:00:00Z'))).toBe(false);
    expect(cdiIsStale(rate, Date.parse('2026-11-09T12:00:01Z'))).toBe(true);
    expect(cdiIsStale(null)).toBe(true);
  });
});