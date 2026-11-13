import { describe, expect, it } from "vitest";
import spreadsheet from "./november-2026.json";
import { buildSeries, cycleSummaries, type Recorrencia, type Tx } from "./finance";
import { CYCLE_HORIZONS, defaultAssumptions, extendProjectionFixed, monthCycleProjection, projectCycles, projectionSummary } from "./cycle-projection";
import { decimalSum } from "./decimal-sum";

const settings = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const rows: Tx[] = spreadsheet.transactions.flatMap((r, index) => {
  const recurrence: Recorrencia = r.parcelas === "Fixo" ? "fixa" : r.parcelas === "1" ? "unica" : "parcelada";
  return buildSeries({ tipo: r.tipo === "entrada" ? "entrada" : "saida", descricao: r.descricao, categoria_id: r.categoria,
    valor: r.valor, data_vencimento: `2026-11-${String(r.dia).padStart(2, "0")}`, pago: false, data_pagamento: null,
    conta_id: r.conta, nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null,
    recorrencia: recurrence, bonificacao: r.bonificacao, observacoes: null, ciclo: r.ciclo },
    { parcelasTotal: recurrence === "parcelada" ? Number(r.parcelas) : 1 }, String(index))
    .map((row, i) => ({ ...row, id: `${index}-${i}`, encerrada: false }));
});
const accounts = spreadsheet.accounts.map(a => ({ id: a.nome, tipo: a.tipo === "cartao_credito" ? "cartao_credito" as const : "conta_corrente" as const }));
const defaults = defaultAssumptions(rows, "2026-11", settings, "Mercado", accounts);
const project = (variableCards = defaults.variableCards, extra: Tx[] = []) => projectCycles([...rows, ...extra], "2026-11", 12, settings, "Mercado", { ...defaults, variableCards });
const at = (index: number, variable?: number) => {
  const month = project(variable)[index];
  if (!month) throw new Error("Missing fixture month");
  return month;
};
describe("cycle savings projection using only the spreadsheet fixture", () => {
  it("uses exact current card singles as the default (26, total 1601.865)", () => {
    expect(rows.filter(t => t.data_vencimento.startsWith("2026-11") && t.recorrencia === "unica" && t.categoria_id !== "Mercado" && t.conta_id === "Nubank Empresa")).toHaveLength(26);
    expect(defaults.variableCards).toBe(1601.865);
    expect(defaults.market).toBe(1200);
  });
  it("current month calls the identical dashboard function regardless of assumptions", () => {
    const dashboard = cycleSummaries(rows, "2026-11", settings, "Mercado");
    const actual = monthCycleProjection(rows, "2026-11", "2026-11", settings, "Mercado", { market: 9999, variableCards: 9999, leisure: 9999 });
    expect(actual.cycles).toEqual(dashboard);
    expect(actual.cycles.c1.contas).toBeCloseTo(6599.995, 6);
    expect(actual.cycles.c1.restou).toBeCloseTo(967.005, 6);
    expect(actual.cycles.c2.contas).toBeCloseTo(7555.27, 6);
    expect(actual.cycles.c2.restou).toBeCloseTo(11.73, 6);
    expect(actual.cycles.guardarParcial).toBeCloseTo(978.735, 6);
    expect(actual.cycles.totalGuardar).toBeCloseTo(2978.735, 6);
  });
  it("December includes variable estimates", () => {
    const m = at(1);
    expect(m.cycles.c1.restou).toBeCloseTo(967.005, 6);
    expect(m.cycles.c2.contas).toBeCloseTo(7338.99, 6);
    expect(m.cycles.c2.restou).toBeCloseTo(228.01, 6);
    expect(m.cycles.totalGuardar).toBeCloseTo(3195.015, 6);
  });
  it("January includes remaining installments and variable estimates", () => {
    expect(at(2).cycles.c2.contas).toBeCloseTo(6165.175, 6);
    expect(at(2).cycles.c2.restou).toBeCloseTo(1401.825, 6);
    expect(at(2).cycles.totalGuardar).toBeCloseTo(4368.83, 6);
  });
  it("December without variables", () => {
    expect(at(1, 0).cycles.c2.restou).toBeCloseTo(1829.875, 6);
    expect(at(1, 0).cycles.totalGuardar).toBeCloseTo(4796.88, 6);
  });
  it("January without variables", () => {
    expect(at(2, 0).cycles.c2.restou).toBeCloseTo(3003.69, 6);
    expect(at(2, 0).cycles.totalGuardar).toBeCloseTo(5970.695, 6);
  });
  it("February without variables ends school and ballet", () => {
    expect(at(3, 0).cycles.c1.contas).toBeCloseTo(5617.74, 6);
    expect(at(3, 0).cycles.c1.restou).toBeCloseTo(1949.26, 6);
    expect(at(3, 0).cycles.c2.contas).toBeCloseTo(4488.31, 6);
    expect(at(3, 0).cycles.c2.restou).toBeCloseTo(3078.69, 6);
    expect(at(3, 0).cycles.totalGuardar).toBeCloseTo(7027.95, 6);
  });
  it("negative cycles produce alerts", () => {
    const negative = projectCycles(rows, "2026-11", 12, settings, "Mercado", { ...defaults, variableCards: 10000 });
    expect(negative[1]?.alerts).toContainEqual({ month: "2026-12", cycle: 2, deficit: 8170.125 });
  });
  it("excluded rows never affect totals or default estimates", () => {
    const base = rows[0];
    if (!base) throw new Error("Missing row");
    const excluded = { ...base, id: "excluded", valor: 50000, nao_contabilizar: true, recorrencia: "unica" as const, conta_id: "Nubank Empresa" };
    expect(project(defaults.variableCards, [excluded])).toEqual(project());
    expect(defaultAssumptions([...rows, excluded], "2026-11", settings, "Mercado", accounts)).toEqual(defaults);
  });
  it("supports 6/12/18/24, generates exactly twelve months by default", () => {
    expect(CYCLE_HORIZONS).toEqual([6, 12, 18, 24]);
    expect(project()).toHaveLength(12);
    expect(project()[11]?.month).toBe("2027-10");
  });
  it("summarizes average, best/worst and first relevant improvement with previous endings", () => {
    const months = project();
    const summary = projectionSummary(months);
    expect(summary.total).toBeCloseTo(months.reduce((s, m) => s + m.cycles.totalGuardar, 0), 6);
    expect(summary.average).toBeCloseTo(summary.total / 12, 6);
    expect(summary.worst?.month).toBe("2026-11");
    expect(summary.best?.cycles.totalGuardar).toBe(Math.max(...months.map(m => m.cycles.totalGuardar)));
    expect(summary.improvement?.month).toBe("2027-01");
    expect(summary.improvement?.endings.some(e => e.description === "IPVA 2026 Polo / Fit")).toBe(true);
  });
  it("situation is tight below 10% of income and negative below zero", () => {
    expect(monthCycleProjection([], "2026-11", "2026-11", settings, "Mercado", defaults).status).toBe("Negativo");
    const low = monthCycleProjection(rows, "2026-12", "2026-11", settings, "Mercado", { ...defaults, variableCards: 4000 });
    expect(low.status).toBe("Apertado");
    expect(at(0).status).toBe("Positivo");
  });
  it("fixed extension is pure, nonduplicating, preserves installments and stops ended groups", () => {
    const first = rows[0];
    if (!first) throw new Error("Missing fixture");
    const fixed = { ...first, id: "fixed", grupo_id: "fixed", recorrencia: "fixa" as const };
    const ended = { ...fixed, id: "ended", grupo_id: "ended", encerrada: true };
    const source = [fixed, ended, first];
    const extended = extendProjectionFixed(source, "2027-02");
    expect(source).toHaveLength(3);
    expect(extended.filter(t => t.grupo_id === "fixed")).toHaveLength(4);
    expect(extended.filter(t => t.grupo_id === "ended")).toHaveLength(1);
    expect(extendProjectionFixed(extended, "2027-02")).toEqual(extended);
    expect(extended.filter(t => t.recorrencia === "parcelada")).toHaveLength(1);
  });
  it("decimal summation is exact before any cents rounding", () => {
    expect(decimalSum([907.255, 49.625])).toBe(956.88);
    expect(decimalSum([0.1, 0.2])).toBe(0.3);
    expect(decimalSum([])).toBe(0);
  });
});
