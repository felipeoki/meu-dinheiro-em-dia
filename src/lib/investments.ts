import { addMonths } from './finance';
import { z } from 'zod';

export const investmentSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  valor_inicial: z.number().finite().min(0).max(1e12),
  aporte_mensal: z.number().finite().min(0).max(1e9),
  data_inicio: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
  tipo_taxa: z.enum(['fixa', 'cdi']),
  taxa_anual: z.number().finite().min(0).max(100).nullable(),
  percentual_cdi: z.number().finite().min(0).max(1000).nullable(),
  horizonte_anos: z.number().int().min(1).max(50),
  capitalizacao: z.enum(['nominal', 'composta']),
  cor: z.enum(['primary', 'chart-2', 'chart-4', 'chart-5']),
  ativo: z.boolean(),
}).refine(v => v.tipo_taxa === 'fixa' ? v.taxa_anual !== null && v.percentual_cdi === null : v.percentual_cdi !== null && v.taxa_anual === null, { message: 'Informe a taxa do investimento.' });
export type InvestmentInput = z.infer<typeof investmentSchema>;
export type Investment = InvestmentInput & { id: string };
export type CdiRate = { taxa_anual: number; referencia: string; fonte: string; atualizado_em: string };
export type CdiState = { rate: CdiRate | null; failed: boolean };
export function effectiveRate(v: Pick<InvestmentInput, 'tipo_taxa' | 'taxa_anual' | 'percentual_cdi'>, cdi: number | null): number | null {
  return v.tipo_taxa === 'fixa' ? v.taxa_anual : cdi === null ? null : cdi * (v.percentual_cdi ?? 0) / 100;
}
export function monthlyRate(annual: number, mode: InvestmentInput['capitalizacao']) {
  return mode === 'nominal' ? annual / 100 / 12 : Math.pow(1 + annual / 100, 1 / 12) - 1;
}
export function simulateInvestment(v: Pick<InvestmentInput, 'valor_inicial' | 'aporte_mensal' | 'data_inicio' | 'capitalizacao'>, annual: number, years: number) {
  if (!Number.isFinite(annual) || annual < 0 || !Number.isInteger(years) || years < 1 || years > 50) throw new Error('Simulação inválida');
  const start = v.data_inicio.slice(0, 7), rate = monthlyRate(annual, v.capitalizacao);
  let saldo = v.valor_inicial;
  return Array.from({ length: years * 12 }, (_, n) => {
    if (n > 0) saldo = (saldo + v.aporte_mensal) * (1 + rate);
    const aportado = v.valor_inicial + n * v.aporte_mensal;
    return { mes: addMonths(start, n), saldo, aportado, rendimento: saldo - aportado };
  });
}
export function annualRows(months: ReturnType<typeof simulateInvestment>, annual: number) {
  const years = [...new Set(months.map(m => m.mes.slice(0, 4)))];
  return years.map(ano => {
    const cells = Array.from({ length: 12 }, (_, i) => months.find(m => m.mes === `${ano}-${String(i + 1).padStart(2, '0')}`) ?? null);
    const last = cells.filter(c => c !== null).at(-1);
    const december = cells[11];
    return { ano, cells, rendaAno: december ? december.saldo * annual / 100 : null, rendaMes: december ? december.saldo * annual / 100 / 12 : null, aportado: last?.aportado ?? 0, rendimento: last?.rendimento ?? 0 };
  });
}
export function parseBcbRate(input: unknown, fallback = false): Pick<CdiRate, 'taxa_anual' | 'referencia' | 'fonte'> | null {
  const parsed = z.array(z.object({ data: z.string(), valor: z.string() })).safeParse(input);
  const row = parsed.success ? parsed.data[0] : undefined;
  if (!row || !/^\d{2}\/\d{2}\/\d{4}$/.test(row.data) || !/^\d+(\.\d+)?$/.test(row.valor)) return null;
  const [day, month, year] = row.data.split('/');
  const reference = `${year}-${month}-${day}`;
  const date = new Date(`${reference}T00:00:00Z`);
  const taxa = Number(row.valor) - (fallback ? 0.1 : 0);
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100 || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== reference) return null;
  return { taxa_anual: taxa, referencia: reference, fonte: fallback ? 'BCB SGS 432 · Selic − 0,10 p.p.' : 'BCB SGS 4389 · CDI base 252' };
}
export function cdiIsStale(rate: CdiRate | null, now = Date.now()) {
  return !rate || !Number.isFinite(Date.parse(rate.atualizado_em)) || now - Date.parse(rate.atualizado_em) > 12 * 60 * 60 * 1000;
}