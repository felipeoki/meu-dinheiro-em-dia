import { z } from "zod";
import { buildMonthReport } from "./month-report";
import { buildJessicaReport, buildReimbursementReport } from "./receipt-reports";
import type { Account, Category, Settings, Tx } from "./finance";

export const METRIC_KEYS = [
  "ciclo1Contas",
  "ciclo2Contas",
  "totalGuardar",
  "jessicaTotal",
  "jessicaPendente",
  "reembolsosTotal",
  "reembolsosPendente",
  "reembolsosRecebido",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
export type ExpectedTotals = Record<MetricKey, number | null>;
export type ActualTotals = Record<MetricKey, number>;

export const METRICS: Record<MetricKey, { label: string; group: "Ciclos e guardar" | "Jéssica" | "Reembolsos" }> = {
  ciclo1Contas: { label: "Ciclo 1 · total de contas", group: "Ciclos e guardar" },
  ciclo2Contas: { label: "Ciclo 2 · total de contas", group: "Ciclos e guardar" },
  totalGuardar: { label: "Total a guardar", group: "Ciclos e guardar" },
  jessicaTotal: { label: "Jéssica · total do mês", group: "Jéssica" },
  jessicaPendente: { label: "Jéssica · a receber", group: "Jéssica" },
  reembolsosTotal: { label: "Reembolsos · total do mês", group: "Reembolsos" },
  reembolsosPendente: { label: "Reembolsos · a receber", group: "Reembolsos" },
  reembolsosRecebido: { label: "Reembolsos · recebido", group: "Reembolsos" },
};

export const emptyExpectedTotals = (): ExpectedTotals => Object.fromEntries(METRIC_KEYS.map(key => [key, null])) as ExpectedTotals;

export const expectedTotalsSchema = z.object({
  ciclo1Contas: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  ciclo2Contas: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  totalGuardar: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  jessicaTotal: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  jessicaPendente: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  reembolsosTotal: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  reembolsosPendente: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
  reembolsosRecebido: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
}).strict();

export interface MetricComparison {
  key: MetricKey;
  expected: number;
  actual: number;
  /** Actual minus expected, without intermediate rounding. */
  difference: number;
  matches: boolean;
}

export interface ReconciliationResult {
  month: string;
  actual: ActualTotals;
  comparisons: MetricComparison[];
  divergenceCount: number;
}

export interface ReconciliationInput {
  txs: Tx[];
  month: string;
  settings: Settings;
  categories: Pick<Category, "id" | "nome">[];
  accounts: Pick<Account, "id" | "nome">[];
  today: string;
}

/** Builds all totals through the same pure report builders used by the existing screens and PDFs. */
export function actualTotals(input: ReconciliationInput): ActualTotals {
  const monthly = buildMonthReport({ ...input, activeProvisionTxIds: new Set<string>() });
  const jessica = buildJessicaReport(input);
  const reimbursements = buildReimbursementReport(input);
  return {
    ciclo1Contas: monthly.c1.contas,
    ciclo2Contas: monthly.c2.contas,
    totalGuardar: monthly.restaraMes,
    jessicaTotal: jessica.totals.total,
    jessicaPendente: jessica.totals.pendente,
    reembolsosTotal: reimbursements.totals.total,
    reembolsosPendente: reimbursements.totals.pendente,
    reembolsosRecebido: reimbursements.totals.recebido,
  };
}

export function compareExpectedTotals(month: string, actual: ActualTotals, expected: ExpectedTotals): ReconciliationResult {
  const comparisons = METRIC_KEYS.flatMap(key => {
    const wanted = expected[key];
    if (wanted == null) return [];
    const difference = actual[key] - wanted;
    // The app presents cents; values that round to the same cent are considered reconciled.
    const matches = Math.round(actual[key] * 100) === Math.round(wanted * 100);
    return [{ key, expected: wanted, actual: actual[key], difference, matches }];
  });
  return { month, actual, comparisons, divergenceCount: comparisons.filter(row => !row.matches).length };
}

export const aiAnalysisSchema = z.object({
  resumo: z.string().trim().min(1).max(1200),
  suspeitas: z.array(z.object({
    transactionId: z.string().uuid().nullable(),
    metricKey: z.enum(METRIC_KEYS).nullable(),
    explicacao: z.string().trim().min(1).max(800),
    impacto: z.number().finite().min(-1_000_000_000).max(1_000_000_000).nullable(),
    confianca: z.enum(["alta", "media", "baixa"]),
  }).strict()).max(8),
  verificacoes: z.array(z.string().trim().min(1).max(400)).max(5),
}).strict();

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

/** Reject malformed output and discard any suspicion pointing to an ID absent from this user's monthly data. */
export function parseAiAnalysis(value: unknown, validTransactionIds: ReadonlySet<string>): AiAnalysis {
  const parsed = aiAnalysisSchema.parse(value);
  return {
    ...parsed,
    suspeitas: parsed.suspeitas.filter(item => item.transactionId == null || validTransactionIds.has(item.transactionId)),
  };
}
