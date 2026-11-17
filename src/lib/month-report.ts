// Pure monthly report builder (no PDF, no IO). Uses the dashboard's cycle rules.
import { cicloOf, dateInMonth, cycleSummaries, inMonth, parcelaLabel, personalTransactions, sum, type Account, type Category, type Settings, type Tx } from "./finance";
import { decimalSum } from "./decimal-sum";

export type ReportStatus = "pago" | "pendente" | "atrasado" | "provisionado";
export interface ReportRow {
  id: string; vencimento: string; descricao: string; categoria: string; conta: string; parcela: string;
  valor: number; status: ReportStatus; pagoEm: string | null; mercado: boolean;
}
export interface ReportCycle {
  ciclo: 1 | 2; entrada: number; bonificacao: number; contas: number; pago: number; falta: number;
  atrasado: number; pctPago: number; lazer: number; restara: number; rows: ReportRow[];
}
export interface MonthReport {
  month: string; today: string; empty: boolean;
  entradas: number; contas: number; pago: number; falta: number; bonificacoes: number; restaraMes: number;
  c1: ReportCycle; c2: ReportCycle;
  incomes: { descricao: string; data: string; valor: number; recebido: boolean }[];
  mercado: { compras: { data: string; descricao: string; valor: number; pago: boolean }[]; gasto: number; orcamento: number; diferenca: number; linha: number; pago: number } | null;
  naoContabilizados: { descricao: string; reembolsoDe: string; valor: number; recebido: boolean }[];
}

export function buildMonthReport(input: {
  txs: Tx[]; month: string; settings: Settings; categories: Pick<Category, "id" | "nome">[];
  accounts: Pick<Account, "id" | "nome">[]; activeProvisionTxIds: ReadonlySet<string>; today: string;
}): MonthReport {
  const { month: m, settings, today } = input;
  const all = input.txs.filter(t => inMonth(t, m) && t.responsavel === "Felipe");
  const personal = personalTransactions(all);
  const mercadoId = input.categories.find(c => c.nome === "Mercado")?.id ?? null;
  const cyc = cycleSummaries(input.txs, m, settings, mercadoId);
  const mercadoCiclo = settings.dia_corte_ciclo <= 26 ? 2 : 1;
  const isMercado = (t: Tx) => mercadoId != null && t.categoria_id === mercadoId;
  const cycleOf = (t: Tx) => (t.ciclo ?? cicloOf(t.data_vencimento, settings.dia_corte_ciclo));
  const catName = (id: string | null) => input.categories.find(c => c.id === id)?.nome ?? "Sem categoria";
  const accName = (id: string | null) => input.accounts.find(a => a.id === id)?.nome ?? "Sem conta";
  const statusOf = (t: Tx): ReportStatus => t.pago ? "pago" : input.activeProvisionTxIds.has(t.id) ? "provisionado" : t.data_vencimento < today ? "atrasado" : "pendente";
  const byDate = (a: Tx, b: Tx) => a.data_vencimento.localeCompare(b.data_vencimento) || a.descricao.localeCompare(b.descricao, "pt-BR") || a.id.localeCompare(b.id);
  const compras = personal.filter(t => t.tipo === "saida" && isMercado(t)).sort(byDate);
  const mercadoPago = sum(compras.filter(t => t.pago));

  const build = (c: 1 | 2): ReportCycle => {
    const s = c === 1 ? cyc.c1 : cyc.c2;
    const bills = personal.filter(t => t.tipo === "saida" && !isMercado(t) && cycleOf(t) === c).sort(byDate);
    const rows: ReportRow[] = bills.map(t => ({ id: t.id, vencimento: t.data_vencimento, descricao: t.descricao || "-", categoria: catName(t.categoria_id),
      conta: accName(t.conta_id), parcela: parcelaLabel(t), valor: Number(t.valor), status: statusOf(t), pagoEm: t.pago ? t.data_pagamento : null, mercado: false }));
    const values = bills.map(t => Number(t.valor));
    const paid = bills.filter(t => t.pago).map(t => Number(t.valor));
    const late = bills.filter(t => !t.pago && t.data_vencimento < today).map(t => Number(t.valor));
    if (c === mercadoCiclo && (compras.length > 0 || cyc.mercado > 0)) {
      // The envelope line is due on the card-closing day, like in the cycles.
      const venc = dateInMonth(m, settings.dia_fechamento_cartao);
      const allPaid = compras.length > 0 && compras.every(t => t.pago);
      rows.push({ id: "mercado-mensal", vencimento: venc, descricao: "Mercado Mensal", categoria: "Mercado", conta: "-", parcela: "Fixo",
        valor: cyc.mercado, status: allPaid && mercadoPago >= cyc.mercado ? "pago" : venc < today ? "atrasado" : "pendente", pagoEm: null, mercado: true });
      rows.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao, "pt-BR"));
      values.push(cyc.mercado); paid.push(mercadoPago);
      if (venc < today) late.push(cyc.mercado - mercadoPago);
    }
    const pago = decimalSum(paid);
    const falta = s.contas - pago;
    return { ciclo: c, entrada: s.entrada, bonificacao: s.bonificacao, contas: s.contas, pago, falta, atrasado: decimalSum(late),
      pctPago: s.contas > 0 ? (pago / s.contas) * 100 : 0, lazer: s.lazer, restara: s.restou, rows };
  };
  const c1 = build(1), c2 = build(2);
  const incomes = personal.filter(t => t.tipo === "entrada").sort(byDate).map(t => ({ descricao: t.descricao, data: t.data_vencimento, valor: Number(t.valor), recebido: t.pago }));
  const naoContabilizados = all.filter(t => t.nao_contabilizar).sort(byDate).map(t => ({ descricao: t.descricao || "-", reembolsoDe: t.reembolso_de ?? "-", valor: Number(t.valor), recebido: t.recebido }));
  return {
    month: m, today, empty: all.length === 0,
    entradas: sum(personal.filter(t => t.tipo === "entrada")),
    contas: c1.contas + c2.contas, pago: decimalSum([c1.pago, c2.pago]), falta: c1.falta + c2.falta,
    bonificacoes: cyc.bonificacoes, restaraMes: cyc.totalGuardar, c1, c2, incomes,
    mercado: compras.length ? { compras: compras.map(t => ({ data: t.data_vencimento, descricao: t.descricao || "-", valor: Number(t.valor), pago: t.pago })),
      gasto: sum(compras), orcamento: settings.orcamento_mercado, diferenca: sum(compras) - settings.orcamento_mercado, linha: cyc.mercado, pago: mercadoPago } : null,
    naoContabilizados,
  };
}

/** Keep Latin-1 only (standard PDF fonts); map common symbols to simple equivalents. */
export function pdfText(s: string): string {
  return s.replace(/[\u2212\u2013\u2014]/g, "-").replace(/[\u2192\u279C]/g, "->").replace(/[\u25BE\u25BC]/g, "v")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, "...").replace(/[\u2022\u25CF]/g, "-")
    .replace(/\u00A0|\u202F/g, " ").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}
