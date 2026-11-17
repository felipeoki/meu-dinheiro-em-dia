import { addMonths, cicloOf, cycleSummaries, dateInMonth, inMonth, installmentEnd, personalTransactions, sum, type Account, type Settings, type Tx } from "./finance";
import { decimalSum } from "./decimal-sum";

export const CYCLE_HORIZONS = [6, 12, 18, 24] as const;
export interface Assumptions { market: number; variableCards: number; leisure: number }
export type ProjectionAccount = Pick<Account, "id" | "tipo">;
export function defaultAssumptions(txs: Tx[], month: string, settings: Settings, marketId: string | null, accounts: ProjectionAccount[]): Assumptions {
  const cards = new Set(accounts.filter(a => a.tipo === "cartao_credito").map(a => a.id));
  return { market: settings.orcamento_mercado, leisure: settings.lazer_por_ciclo,
    variableCards: sum(personalTransactions(txs).filter(t => inMonth(t, month) && t.tipo === "saida" && t.recorrencia === "unica" && t.categoria_id !== marketId && t.conta_id != null && cards.has(t.conta_id))) };
}

/** Read-only extension: existing fixed rows win; ended groups are never extended. */
export function extendProjectionFixed(txs: Tx[], through: string): Tx[] {
  const result = [...txs];
  const groups = new Map<string, Tx[]>();
  for (const t of txs.filter(t => t.recorrencia === "fixa")) {
    const key = t.grupo_id ?? t.id;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const [id, rows] of groups) {
    const last = [...rows].sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento))[0];
    if (!last || last.encerrada) continue;
    for (let month = addMonths(last.data_vencimento.slice(0, 7), 1); month <= through; month = addMonths(month, 1)) {
      result.push({ ...last, id: `projection-${id}-${month}`, data_vencimento: dateInMonth(month, Number(last.data_vencimento.slice(8))), pago: false, data_pagamento: null });
    }
  }
  return result;
}

export function monthCycleProjection(txs: Tx[], month: string, start: string, settings: Settings, marketId: string | null, assumptions: Assumptions) {
  const future = month > start;
  const registered = personalTransactions(txs).filter(t => inMonth(t, month));
  const estimated: Tx[] = [];
  if (future && assumptions.variableCards > 0) estimated.push({
    id: `estimate-${month}`, tipo: "saida", descricao: "Gastos variáveis do cartão (estimativa)", categoria_id: null, valor: assumptions.variableCards,
    data_vencimento: `${month}-26`, pago: false, data_pagamento: null, conta_id: null, responsavel: "Felipe", nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null,
    recorrencia: "unica", parcela_atual: null, parcelas_total: null, grupo_id: null, ciclo: 2, bonificacao: false, encerrada: false, observacoes: null,
  });
  const appliedSettings = future ? { ...settings, orcamento_mercado: assumptions.market, lazer_por_ciclo: assumptions.leisure } : settings;
  const cycles = cycleSummaries([...registered, ...estimated], month, appliedSettings, marketId);
  const income = decimalSum([cycles.c1.entrada, cycles.c2.entrada, cycles.bonificacoes]);
  const events = new Map<string, { id: string; description: string; value: number }>();
  for (const t of personalTransactions(txs)) {
    if (t.tipo !== "saida" || t.categoria_id === marketId || installmentEnd(t) !== month) continue;
    const id = t.grupo_id ?? t.id;
    events.set(id, { id, description: t.descricao, value: t.valor });
  }
  const details = ([cycles.c1, cycles.c2] as const).map(cycle => ({
    ...cycle,
    largest: registered.filter(t => t.tipo === "saida" && t.categoria_id !== marketId && (t.ciclo ?? cicloOf(t.data_vencimento, settings.dia_corte_ciclo)) === cycle.ciclo).sort((a, b) => b.valor - a.valor).slice(0, 5),
    market: (settings.dia_corte_ciclo <= 26 ? 2 : 1) === cycle.ciclo ? cycles.mercado : null,
    marketRegistered: sum(registered.filter(t => t.tipo === "saida" && t.categoria_id === marketId)),
    variable: future && cycle.ciclo === 2 ? assumptions.variableCards : 0,
  }));
  return { month, future, cycles, details, income, events: [...events.values()],
    status: cycles.totalGuardar < 0 ? "Negativo" : cycles.totalGuardar < income * 0.1 ? "Apertado" : "Positivo",
    alerts: [cycles.c1, cycles.c2].filter(c => c.restou < 0).map(c => ({ month, cycle: c.ciclo, deficit: -c.restou })),
  };
}
export function projectCycles(txs: Tx[], start: string, horizon: number, settings: Settings, marketId: string | null, assumptions: Assumptions) {
  const rows = extendProjectionFixed(txs, addMonths(start, horizon - 1));
  return Array.from({ length: horizon }, (_, i) => monthCycleProjection(rows, addMonths(start, i), start, settings, marketId, assumptions));
}
export type ProjectedMonth = ReturnType<typeof monthCycleProjection>;
/** Relevant improvement: at least 10% of the preceding savings, with a R$100 floor. */
export function projectionSummary(months: ProjectedMonth[]) {
  const total = decimalSum(months.map(m => m.cycles.totalGuardar));
  const ranked = [...months].sort((a, b) => a.cycles.totalGuardar - b.cycles.totalGuardar);
  const index = months.findIndex((m, i) => {
    const previous = months[i - 1];
    return previous != null && m.cycles.totalGuardar - previous.cycles.totalGuardar >= Math.max(100, Math.abs(previous.cycles.totalGuardar) * 0.1);
  });
  const next = months[index];
  const previous = months[index - 1];
  return { total, average: months.length ? total / months.length : 0, worst: ranked[0], best: ranked[ranked.length - 1],
    improvement: next && previous ? { month: next.month, before: previous.cycles.totalGuardar, after: next.cycles.totalGuardar, endings: previous.events,
      marketDifference: previous.cycles.mercado - next.cycles.mercado,
      incomeDifference: next.income - previous.income } : null,
  };
}