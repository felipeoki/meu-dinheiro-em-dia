import { describe, expect, it } from 'vitest';
import { contributionTargets, saoPauloToday, simulateWithContributions, validateContribution } from './contributions';
import { simulateInvestment } from './investments';
const v = { valor_inicial: 100, aporte_mensal: 250, data_inicio: '2026-11-01', capitalizacao: 'nominal' as const };
const at = (rows: ReturnType<typeof simulateWithContributions>, mes: string) => rows.find(r => r.mes === mes)?.saldo ?? NaN;
const input = { investment_id: '00000000-0000-4000-8000-000000000001', data: '2026-11-10', valor: 100, observacao: null };
describe('actual investment contributions', () => {
  it('without records is exactly the original spreadsheet, including December 2045', () => {
    const plan = { ...v, data_inicio: '2022-10-01' };
    const actual = simulateWithContributions(plan, 12, 30, [], '2026-11-11');
    expect(actual.map(({ mes, saldo, aportado, rendimento }) => ({ mes, saldo, aportado, rendimento }))).toEqual(simulateInvestment(plan, 12, 30));
    expect(at(actual, '2022-10')).toBe(100);
    expect(at(actual, '2022-11')).toBe(353.5);
    expect(at(actual, '2022-12')).toBe(609.535);
    expect(at(actual, '2023-01')).toBeCloseTo(868.13035, 8);
    expect(at(actual, '2045-12')).toBeCloseTo(377763.760779, 6);
  });
  it('B: start-month actual has no interest, dates earn partial monthly interest', () => {
    const rows = simulateWithContributions(v, 12, 5, [{ data: '2026-11-20', valor: 300 }, { data: '2026-12-10', valor: 100 }, { data: '2026-12-20', valor: 150 }], '2026-12-15');
    expect(Math.abs(at(rows, '2026-11') - 400)).toBeLessThan(1e-6);
    expect(Math.abs(at(rows, '2026-12') - 655.290323)).toBeLessThan(1e-6);
    expect(Math.abs(at(rows, '2027-01') - 914.343226)).toBeLessThan(1e-6);
  });
  it('C: closed missing months use zero, current missing month uses plan', () => {
    const rows = simulateWithContributions(v, 12, 5, [{ data: '2026-12-05', valor: 400 }], '2027-02-10');
    for (const [mes, expected] of [['2026-11', 100], ['2026-12', 504.483871], ['2027-01', 509.528710], ['2027-02', 767.123997]] as const) expect(Math.abs(at(rows, mes) - expected)).toBeLessThan(1e-6);
  });
  it('D: day 1 earns a full month and is exactly the planned contribution', () => {
    const actual = simulateWithContributions(v, 12, 5, [{ data: '2026-12-01', valor: 250 }], '2026-12-15');
    expect(at(actual, '2026-12')).toBe(at(simulateWithContributions(v, 12, 5, [], '2026-12-15'), '2026-12'));
    const future = simulateWithContributions(v, 12, 5, [{ data: '2026-12-01', valor: 250 }], '2026-11-15');
    expect(at(future, '2026-12')).toBe(353.5);
  });
  it('E: rejects future dates', () => expect(validateContribution({ ...input, data: '2026-11-12' }, v.data_inicio, '2026-11-11')).toMatch(/futura/));
  it('E: rejects dates before start', () => expect(validateContribution({ ...input, data: '2026-10-31' }, v.data_inicio, '2026-11-11')).toMatch(/anterior/));
  it.each([0, -1])('E: rejects nonpositive value %s', valor => expect(validateContribution({ ...input, valor }, v.data_inicio, '2026-11-11')).toBeTruthy());
  it('rejects invalid dates and notes above 200 characters', () => {
    expect(validateContribution({ ...input, data: '2026-02-30' }, '2026-01-01', '2026-11-11')).toMatch(/válida/);
    expect(validateContribution({ ...input, observacao: 'a'.repeat(201) }, v.data_inicio, '2026-11-11')).toBeTruthy();
    expect(validateContribution({ ...input, observacao: 'a'.repeat(200) }, v.data_inicio, '2026-11-11')).toBeNull();
  });
  it('today uses Sao Paulo rather than UTC at midnight', () => expect(saoPauloToday(new Date('2026-11-12T02:00:00Z'))).toBe('2026-11-11'));
  it('what-if future contributions do not replace actual or past months', () => {
    const recorded = [{ data: '2026-12-05', valor: 400 }];
    const normal = simulateWithContributions(v, 12, 5, recorded, '2027-02-10');
    const scenario = simulateWithContributions(v, 12, 5, recorded, '2027-02-10', 500);
    expect(scenario.slice(0, 4)).toEqual(normal.slice(0, 4));
    expect(at(scenario, '2027-03')).toBeGreaterThan(at(normal, '2027-03'));
    expect(v.aporte_mensal).toBe(250);
  });
  it('total used capital and targets track actual contributions separately', () => {
    const records = [{ data: '2026-12-05', valor: 400 }];
    const rows = simulateWithContributions(v, 12, 5, records, '2027-02-10');
    expect(rows.find(r => r.mes === '2027-01')?.aportado).toBe(500);
    expect(contributionTargets(v, records, '2027-02-10')).toEqual([{ mes: '2026-11', meta: 0, realizado: 0, diferenca: 0 }, { mes: '2026-12', meta: 250, realizado: 400, diferenca: 150 }, { mes: '2027-01', meta: 250, realizado: 0, diferenca: -250 }, { mes: '2027-02', meta: 250, realizado: 0, diferenca: -250 }]);
  });
});