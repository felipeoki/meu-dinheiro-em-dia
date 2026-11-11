import { z } from 'zod';
import { addMonths } from './finance';
import { monthlyRate, simulateInvestment, type InvestmentInput } from './investments';

export const contributionSchema = z.object({ investment_id: z.string().uuid(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), valor: z.number().finite().positive('Informe um valor maior que zero.').max(999999999999.99), observacao: z.string().trim().max(200).nullable() });
export type ContributionInput = z.infer<typeof contributionSchema>;
export type Contribution = ContributionInput & { id: string };
export function saoPauloToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validateContribution(value: ContributionInput, start: string, today: string): string | null {
  const parsed = contributionSchema.safeParse(value);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Confira o aporte.';
  const date = new Date(`${value.data}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.data) return 'Informe uma data válida.';
  if (value.data > today) return 'Não é permitido registrar aporte com data futura.';
  if (value.data < start) return 'A data não pode ser anterior ao mês de início do plano.';
  return null;
}
type Plan = Pick<InvestmentInput, 'valor_inicial' | 'aporte_mensal' | 'data_inicio' | 'capitalizacao'>;
type Actual = Pick<ContributionInput, 'data' | 'valor'>;
export function simulateWithContributions(v: Plan, annual: number, years: number, contributions: readonly Actual[], today: string, futureContribution = v.aporte_mensal) {
  const original = simulateInvestment(v, annual, years);
  const first = contributions.map(c => c.data.slice(0, 7)).sort()[0];
  const current = today.slice(0, 7), rate = monthlyRate(annual, v.capitalizacao);
  let saldo = v.valor_inicial, aportado = v.valor_inicial;
  return original.map((plan, n) => {
    const actual = contributions.filter(c => c.data.startsWith(plan.mes));
    // UI/server reject future dates; the pure simulator accepts fixtures and historical scenarios.
    const usesActual = first !== undefined && plan.mes >= first && plan.mes <= current && (plan.mes < current || actual.length > 0);
    const used = usesActual ? actual.reduce((s, c) => s + c.valor, 0) : n === 0 ? 0 : plan.mes > current ? futureContribution : v.aporte_mensal;
    if (n === 0) saldo += used;
    else if (usesActual) {
      const [year, month] = plan.mes.split('-').map(Number);
      const days = new Date(year ?? 0, month ?? 1, 0).getDate();
      saldo = saldo * (1 + rate) + actual.reduce((s, c) => s + c.valor * (1 + rate * (days - Number(c.data.slice(8, 10)) + 1) / days), 0);
    } else saldo = (saldo + used) * (1 + rate);
    aportado += used;
    return { mes: plan.mes, saldo, aportado, rendimento: saldo - aportado, original: plan.saldo, realizado: actual.reduce((s, c) => s + c.valor, 0), usaReal: usesActual && actual.length > 0, usado: used };
  });
}
export function contributionTargets(v: Plan, contributions: readonly Actual[], today: string) {
  const start = v.data_inicio.slice(0, 7), end = today.slice(0, 7);
  const result = [];
  for (let mes = start; mes <= end; mes = addMonths(mes, 1)) {
    const meta = mes === start ? 0 : v.aporte_mensal;
    const realizado = contributions.filter(c => c.data.startsWith(mes)).reduce((s, c) => s + c.valor, 0);
    result.push({ mes, meta, realizado, diferenca: realizado - meta });
  }
  return result;
}