import { describe, expect, it } from "vitest";
import spreadsheet from "./november-2026.json";
import jessica from "./jessica-2026.json";
import { buildSeries, cycleSummaries, sum, type Tx } from "./finance";
import { outsideSummary, reimbursementRows, validateReceiptDate } from "./outside-accounting";

const settings = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const base = { pago: false, data_pagamento: null, nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null, observacoes: null, bonificacao: false };
const felipe: Tx[] = spreadsheet.transactions.flatMap((r, n) => buildSeries({ ...base, responsavel: "Felipe", tipo: r.tipo === "entrada" ? "entrada" : "saida", descricao: r.descricao, categoria_id: r.categoria, conta_id: r.conta, valor: r.valor, data_vencimento: `2026-11-${String(r.dia).padStart(2, "0")}`, recorrencia: r.parcelas === "Fixo" ? "fixa" : r.parcelas === "1" ? "unica" : "parcelada", bonificacao: r.bonificacao, ciclo: r.ciclo }, { parcelasTotal: Number(r.parcelas) || 1 }, `f-${n}`).map((t, i) => ({ ...t, id: `f-${n}-${i}`, encerrada: false })));
const hers: Tx[] = jessica.flatMap((r, n) => buildSeries({ ...base, responsavel: "Jéssica", tipo: "saida", descricao: r.descricao, categoria_id: r.categoria, conta_id: r.conta, valor: r.valor, data_vencimento: "2026-11-26", recorrencia: r.atual === 0 ? "fixa" : r.total > 1 ? "parcelada" : "unica" }, { parcelasTotal: r.total, parcelasPagas: Math.max(0, r.atual - 1) }, `j-${n}`).map((t, i) => ({ ...t, id: `j-${n}-${i}`, encerrada: false })));
const reimb = (id: string, descricao: string, valor: number, recebido: boolean): Tx => ({ ...felipe[0]!, ...base, id, grupo_id: id, tipo: "saida", recorrencia: "unica", parcela_atual: null, parcelas_total: null, descricao, valor, data_vencimento: "2026-11-26", conta_id: "Nubank Empresa", categoria_id: "Outros", nao_contabilizar: true, reembolso_de: "Time", recebido, recebido_em: recebido ? "2026-11-15" : null });
const scenarioA = [...felipe, ...hers, reimb("r1", "IA EXPERIENCE", 355, false), reimb("r2", "BYD", 65.6, true)];
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.01);

describe("outside my accounts", () => {
  it("Jéssica November is 2654.72, all pending", () => {
    const s = outsideSummary([...felipe, ...hers], "2026-11");
    near(s.jessica.total, 2654.72); near(s.jessica.pendente, 2654.72); near(s.jessica.recebido, 0);
  });
  it("scenario A: reimbursements 420.60 and outside 3075.32", () => {
    const s = outsideSummary(scenarioA, "2026-11");
    near(s.reembolsos.total, 420.6); near(s.reembolsos.pendente, 355); near(s.reembolsos.recebido, 65.6);
    near(s.total, 3075.32); near(s.pendente, 3009.72); near(s.recebido, 65.6);
  });
  it("scenario B: Posto Guaçu received", () => {
    const rows = scenarioA.map(t => t.responsavel === "Jéssica" && t.descricao === "Posto Guaçu Brasil" && t.valor === 295.24 && t.data_vencimento.startsWith("2026-11") ? { ...t, recebido: true, recebido_em: "2026-11-20" } : t);
    const s = outsideSummary(rows, "2026-11");
    near(s.jessica.pendente, 2359.48); near(s.jessica.recebido, 295.24);
    near(s.total, 3075.32); near(s.pendente, 2714.48); near(s.recebido, 360.84);
  });
  it("Whey not counted lowers C2 and restores", () => {
    const flip = (v: boolean) => felipe.map(t => t.descricao === "Whey" ? { ...t, nao_contabilizar: v, reembolso_de: v ? "Empresa" : null } : t);
    const off = cycleSummaries(flip(true), "2026-11", settings, "Mercado");
    near(off.c2.contas, 7422.77); near(off.c2.restou, 144.23); near(off.totalGuardar, 3111.235);
    const on = cycleSummaries(flip(false), "2026-11", settings, "Mercado");
    near(on.c2.contas, 7555.27); near(on.c2.restou, 11.73); near(on.totalGuardar, 2978.735);
  });
  it("excluded Jéssica item counts once", () => {
    const rows = [...felipe, ...hers.map(t => t.descricao === "Whey" ? { ...t, nao_contabilizar: true } : t)];
    const s = outsideSummary(rows, "2026-11");
    near(s.total, 2654.72); near(s.jessica.total, 2654.72); near(s.reembolsos.total, 0);
  });
  it("Jéssica December is 1126.07", () => near(sum(hers.filter(t => t.data_vencimento.startsWith("2026-12"))), 1126.07));
  it("rejects future receipt dates", () => {
    expect(() => validateReceiptDate("2026-11-21", "2026-11-20")).toThrow();
    expect(() => validateReceiptDate("2026-11-20", "2026-11-20")).not.toThrow();
  });
  it("Jéssica never appears in Notes > To receive", () => {
    expect(reimbursementRows([...hers.map(t => ({ ...t, nao_contabilizar: true })), reimb("r1", "IA", 355, false)]).map(t => t.id)).toEqual(["r1"]);
  });
});
