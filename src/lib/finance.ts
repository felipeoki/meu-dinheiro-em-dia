// Pure finance helpers (no IO) — easy to test.
import { decimalSum } from "./decimal-sum";
export type Tipo = "entrada" | "saida";
export type Recorrencia = "unica" | "fixa" | "parcelada";
export type Responsavel = "Felipe" | "Jéssica";
export function parseResponsavel(value: unknown, fallback: Responsavel = "Felipe"): Responsavel {
  if (value == null || String(value).trim() === "") return fallback;
  if (value === "Felipe" || value === "Jéssica") return value;
  throw new Error("Responsável deve ser Felipe ou Jéssica.");
}

export interface Tx {
  id: string;
  tipo: Tipo;
  descricao: string;
  categoria_id: string | null;
  valor: number;
  data_vencimento: string; // yyyy-mm-dd
  pago: boolean;
  data_pagamento: string | null;
  conta_id: string | null;
  nao_contabilizar: boolean;
  responsavel: Responsavel;
  reembolso_de: string | null;
  recebido: boolean;
  recebido_em: string | null;
  recorrencia: Recorrencia;
  parcela_atual: number | null;
  parcelas_total: number | null;
  grupo_id: string | null;
  ciclo: number | null;
  bonificacao: boolean;
  encerrada: boolean;
  observacoes: string | null;
}
export interface Category {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  orcamento_mensal: number | null;
}
export interface Settings {
  orcamento_mercado: number;
  lazer_por_ciclo: number;
  dia_corte_ciclo: number;
  dia_fechamento_cartao: number;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const fmtBRL = (v: number) => brl.format(Math.round(v * 100) / 100);
export const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** month key "yyyy-mm" */
export const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
export const addMonths = (key: string, n: number) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};
export const monthLabel = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return `${MESES[m - 1]}/${y}`;
};
export const monthShort = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return `${MESES[m - 1]?.slice(0, 3) ?? ""}/${String(y).slice(2)}`;
};
export const monthStart = (key: string) => `${key}-01`;
export const monthEnd = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};
export const inMonth = (t: { data_vencimento: string }, key: string) => t.data_vencimento.startsWith(key);
/** date in a month, clamped to last day */
export const dateInMonth = (key: string, day: number) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return `${key}-${String(Math.min(day, last)).padStart(2, "0")}`;
};
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dayOf = (iso: string) => Number(iso.slice(8, 10));

export const cicloOf = (iso: string, corte: number) => (dayOf(iso) < corte ? 1 : 2);

export const sum = (xs: { valor: number }[]) => decimalSum(xs.map(row => Number(row.valor)));

export const parcelaLabel = (t: Pick<Tx, "recorrencia" | "parcela_atual" | "parcelas_total">) =>
  t.recorrencia === "fixa" ? "Fixo" : t.recorrencia === "parcelada" ? `${t.parcela_atual}/${t.parcelas_total}` : "Única";

export const isOverdue = (t: Pick<Tx, "pago" | "data_vencimento" | "tipo">, today = todayISO()) =>
  t.tipo === "saida" && !t.pago && t.data_vencimento < today;

export interface CycleSummary {
  ciclo: 1 | 2;
  entrada: number;
  bonificacao: number;
  contas: number;
  liquido: number;
  lazer: number;
  restou: number;
}

/** Mercado envelope value counted in bills: the spend, or the budget if still below it. */
export const mercadoMensal = (gasto: number, orcamento: number) => Math.max(gasto, orcamento);

/**
 * Cycle summary for a month like the spreadsheet.
 * Mercado purchases are replaced by a single "Mercado Mensal" line on the cycle of the
 * card-closing day (dia 26 → ciclo 2 with default cut).
 */
export function cycleSummaries(
  txs: Tx[],
  monthK: string,
  settings: Settings,
  mercadoCatId: string | null,
): { c1: CycleSummary; c2: CycleSummary; guardarParcial: number; bonificacoes: number; totalGuardar: number; mercado: number } {
  const month = personalTransactions(txs).filter((t) => inMonth(t, monthK));
  const isMercado = (t: Tx) => mercadoCatId != null && t.categoria_id === mercadoCatId;
  const gastoMercado = sum(month.filter((t) => t.tipo === "saida" && isMercado(t)));
  const mercado = mercadoMensal(gastoMercado, settings.orcamento_mercado);
  const mercadoCiclo = settings.dia_corte_ciclo <= 26 ? 2 : 1;
  const build = (c: 1 | 2): CycleSummary => {
    const cyc = (t: Tx) => (t.ciclo ?? cicloOf(t.data_vencimento, settings.dia_corte_ciclo)) === c;
    const entrada = sum(month.filter((t) => t.tipo === "entrada" && !t.bonificacao && cyc(t)));
    const bonificacao = sum(month.filter((t) => t.tipo === "entrada" && t.bonificacao && cyc(t)));
    const contas =
      sum(month.filter((t) => t.tipo === "saida" && !isMercado(t) && cyc(t))) + (c === mercadoCiclo ? mercado : 0);
    const liquido = entrada - contas;
    const lazer = settings.lazer_por_ciclo;
    return { ciclo: c, entrada, bonificacao, contas, liquido, lazer, restou: liquido - lazer };
  };
  const c1 = build(1);
  const c2 = build(2);
  const guardarParcial = c1.restou + c2.restou;
  const bonificacoes = c1.bonificacao + c2.bonificacao;
  return { c1, c2, guardarParcial, bonificacoes, totalGuardar: guardarParcial + bonificacoes, mercado };
}

/** Card invoice month: purchases up to closing day belong to the month; after it, to the next. */
export const faturaMonth = (iso: string, fechamento: number) => {
  const key = iso.slice(0, 7);
  return dayOf(iso) <= fechamento ? key : addMonths(key, 1);
};

export type EnvelopeStatus = "ok" | "alerta" | "estourou";
export const envelopeStatus = (gasto: number, orcamento: number): EnvelopeStatus =>
  gasto > orcamento ? "estourou" : gasto >= orcamento * 0.8 ? "alerta" : "ok";

/** Build rows for a new launch. Fixa → 12 months; Parcelada → (pagas+1..total). */
export function buildSeries(
  base: Omit<Tx, "id" | "parcela_atual" | "parcelas_total" | "grupo_id" | "ciclo" | "encerrada"> & { ciclo?: number | null },
  opts: { parcelasTotal?: number; parcelasPagas?: number },
  grupoId: string,
) {
  const day = dayOf(base.data_vencimento);
  const startKey = base.data_vencimento.slice(0, 7);
  const rows: Omit<Tx, "id" | "encerrada">[] = [];
  if (base.recorrencia === "unica") {
    rows.push({ ...base, ciclo: base.ciclo ?? null, parcela_atual: null, parcelas_total: null, grupo_id: grupoId });
  } else if (base.recorrencia === "fixa") {
    for (let i = 0; i < 12; i++)
      rows.push({
        ...base,
        ciclo: base.ciclo ?? null,
        data_vencimento: i === 0 ? base.data_vencimento : dateInMonth(addMonths(startKey, i), day),
        pago: i === 0 ? base.pago : false,
        data_pagamento: i === 0 ? base.data_pagamento : null,
        parcela_atual: null,
        parcelas_total: null,
        grupo_id: grupoId,
      });
  } else {
    const total = Math.max(1, opts.parcelasTotal ?? 1);
    const pagas = Math.min(Math.max(0, opts.parcelasPagas ?? 0), total - 1);
    for (let p = pagas + 1, i = 0; p <= total; p++, i++)
      rows.push({
        ...base,
        ciclo: base.ciclo ?? null,
        data_vencimento: i === 0 ? base.data_vencimento : dateInMonth(addMonths(startKey, i), day),
        pago: i === 0 ? base.pago : false,
        data_pagamento: i === 0 ? base.data_pagamento : null,
        parcela_atual: p,
        parcelas_total: total,
        grupo_id: grupoId,
      });
  }
  return rows;
}

/** Parse "1.234,56" / "1234.56" / number. */
export const parseValor = (v: unknown): number => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
/** Parse dd/mm/aaaa, yyyy-mm-dd, Excel serial, or a bare day (uses fallback month). */
export const parseData = (v: unknown, fallbackMonth: string): string | null => {
  if (typeof v === "number") {
    if (v >= 1 && v <= 31) return dateInMonth(fallbackMonth, v);
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m?.[1] && m[2] && m[3]) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(?:dia\s*)?(\d{1,2})$/i);
  if (m) return dateInMonth(fallbackMonth, Number(m[1]));
  return null;
};

export interface Account {
  id: string; nome: string; tipo: "cartao_credito" | "conta_corrente" | "dinheiro" | "outro";
  cor: string; dia_fechamento: number | null; dia_vencimento: number | null; limite: number | null; ativo: boolean; ordem: number;
}
export const isPersonalTransaction = (t: Pick<Tx, "responsavel" | "nao_contabilizar">) => t.responsavel === "Felipe" && !t.nao_contabilizar;
export const personalTransactions = (txs: Tx[]) => txs.filter(isPersonalTransaction);
export const invoiceSummary = (txs: Tx[]) => {
  const total = sum(txs);
  const receber = sum(txs.filter(t => t.nao_contabilizar && !t.recebido));
  return { total, receber, suaParte: total - receber };
};
export const invoicePartition = (txs: Tx[]) => ({
  total: sum(txs), felipe: sum(personalTransactions(txs)),
  jessica: sum(txs.filter(t => !isPersonalTransaction(t) && !t.nao_contabilizar)),
  empresa: sum(txs.filter(t => t.nao_contabilizar)),
});
export const installmentEnd = (t: Tx): string | null => t.recorrencia === "parcelada" && t.parcelas_total != null && t.parcela_atual != null
  ? addMonths(t.data_vencimento.slice(0, 7), t.parcelas_total - t.parcela_atual) : null;
export const PROJECTION_HORIZONS = [12,18,24,36] as const;
export function projection(txs: Tx[], start: string, horizon: number, settings: Settings, mercadoId: string | null) {
  const months = Array.from({length:horizon}, (_,i) => addMonths(start,i));
  const own = personalTransactions(txs);
  const groups = new Map<string,Tx[]>();
  for (const t of own.filter(t => t.tipo === "saida" && t.recorrencia !== "unica" && (mercadoId == null || t.categoria_id !== mercadoId))) {
    const id = t.grupo_id ?? t.id;
    groups.set(id,[...(groups.get(id) ?? []),t]);
  }
  const rows = [...groups.entries()].map(([id,items]) => {
    const first = items[0];
    if (!first) throw new Error("Grupo vazio");
    const end = installmentEnd(first);
    return {id,tx:first,end,remaining:end ? Math.min((first.parcelas_total ?? 0)-(first.parcela_atual ?? 1)+1, Math.max(0, (Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1)):null,
      values: months.map(m => sum(items.filter(t => inMonth(t,m))))};
  }).sort((a,b) => (a.end ?? "9999").localeCompare(b.end ?? "9999"));
  const totals = months.map(m => {
    const items = own.filter(t => inMonth(t,m));
    const mercado = mercadoMensal(sum(items.filter(t => t.tipo === "saida" && mercadoId != null && t.categoria_id === mercadoId)),settings.orcamento_mercado);
    const saidas = sum(items.filter(t => t.tipo === "saida" && (mercadoId == null || t.categoria_id !== mercadoId)))+mercado;
    const entradas = sum(items.filter(t => t.tipo === "entrada"));
    return {mes:m,saidas,entradas,saldo:entradas-saidas,mercado};
  });
  let accumulated=0;
  const endings = rows.filter(r => r.end != null && months.includes(r.end)).map(r => {
    accumulated+=r.tx.valor;
    return {...r,liberado:r.tx.valor,acumulado:accumulated};
  });
  return {months,rows,totals,endings};
}
