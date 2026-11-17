import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import spreadsheet from "./november-2026.json";
import { buildSeries, cycleSummaries, envelopeStatus, installmentEnd, projection, sum, type Recorrencia, type Tx } from "./finance";

const settings = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const rows: Tx[] = spreadsheet.transactions.flatMap((r, index) => {
  const recurrence: Recorrencia = r.parcelas === "Fixo" ? "fixa" : r.parcelas === "1" ? "unica" : "parcelada";
  return buildSeries({ tipo: r.tipo === "entrada" ? "entrada" : "saida", descricao: r.descricao, categoria_id: r.categoria,
    valor: r.valor, data_vencimento: `2026-11-${String(r.dia).padStart(2, "0")}`, pago: false, data_pagamento: null,
    conta_id: r.conta, responsavel: "Felipe", nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null,
    recorrencia: recurrence, bonificacao: r.bonificacao, observacoes: null, ciclo: r.ciclo },
    { parcelasTotal: recurrence === "parcelada" ? Number(r.parcelas) : 1 }, String(index))
    .map((row, i) => ({ ...row, id: `${index}-${i}`, encerrada: false }));
});
const november = rows.filter(r => r.data_vencimento.startsWith("2026-11"));
const cycles = cycleSummaries(rows, "2026-11", settings, "Mercado");

describe("November 2026 spreadsheet", () => {
  it("loads 87 November transactions: 68 bills, 15 market purchases and 4 incomes", () => {
    expect(november).toHaveLength(87);
    expect(november.filter(r => r.tipo === "entrada")).toHaveLength(4);
    expect(november.filter(r => r.categoria_id === "Mercado")).toHaveLength(15);
    expect(november.filter(r => r.tipo === "saida" && r.categoria_id !== "Mercado")).toHaveLength(68);
  });
  it("uses the fifteen purchases, not a market transaction envelope", () => {
    const market = november.filter(r => r.categoria_id === "Mercado");
    expect(sum(market)).toBeCloseTo(1416.28, 6);
    expect(sum(market) - settings.orcamento_mercado).toBeCloseTo(216.28, 6);
    expect(envelopeStatus(sum(market), settings.orcamento_mercado)).toBe("estourou");
    expect(november.some(r => r.descricao === "Mercado Mensal")).toBe(false);
    expect(market.filter(r => r.descricao === "")).toHaveLength(14);
    expect(market.find(r => r.valor === 158.22)?.descricao).toBe("1/2");
    expect(market.every(r => r.conta_id === "Nubank Empresa" && r.data_vencimento === "2026-11-10")).toBe(true);
  });
  it("preserves cycle 1 exact three-decimal totals", () => {
    expect(cycles.c1.contas).toBeCloseTo(6599.995, 6);
    expect(cycles.c1.liquido).toBeCloseTo(1467.005, 6);
    expect(cycles.c1.restou).toBeCloseTo(967.005, 6);
  });
  it("includes market once in cycle 2", () => {
    expect(cycles.c2.contas).toBeCloseTo(7555.27, 6);
    expect(cycles.c2.liquido).toBeCloseTo(511.73, 6);
    expect(cycles.c2.restou).toBeCloseTo(11.73, 6);
  });
  it("keeps bonuses separate and matches savings totals", () => {
    expect(cycles.guardarParcial).toBeCloseTo(978.735, 6);
    expect(cycles.bonificacoes).toBe(2000);
    expect(cycles.totalGuardar).toBeCloseTo(2978.735, 6);
  });
  it("projects only fixed bills and remaining installments after November", () => {
    expect(rows.some(r => r.data_vencimento < "2026-11-01")).toBe(false);
    expect(rows.filter(r => r.data_vencimento >= "2026-12-01").every(r => r.recorrencia !== "unica" && !r.pago)).toBe(true);
    const december = rows.filter(r => r.data_vencimento.startsWith("2026-12"));
    expect(december).toHaveLength(spreadsheet.transactions.filter(r => r.parcelas !== "1").length);
    expect(december.find(r => r.descricao === "FIES - Felipe")?.parcela_atual).toBe(2);
    expect(rows.filter(r => r.descricao === "FIES - Felipe")).toHaveLength(90);
    const fies = november.find(r => r.descricao === "FIES - Felipe");
    expect(fies).toBeDefined();
    if (!fies) throw new Error("FIES ausente da planilha");
    expect(installmentEnd(fies)).toBe("2034-04");
    expect(projection(rows, "2026-11", 12, settings, "Mercado").totals[1]?.mercado).toBe(1200);
  });
  it("keeps all loaded values unpaid with exact school and shoe precision", () => {
    expect(rows.every(r => !r.pago && r.data_pagamento === null && !r.nao_contabilizar)).toBe(true);
    expect(november.find(r => r.descricao === "Escola Sofia (Imaculada)")?.valor).toBe(907.255);
    expect(november.find(r => r.descricao === "Tenis Sofia")?.valor).toBe(49.625);
    expect(november.find(r => r.descricao === "Japonesa Kids")?.valor).toBe(61.125);
  });
  it("defines five default accounts and the specified card colors", () => {
    expect(spreadsheet.accounts).toHaveLength(5);
    expect(new Set(spreadsheet.accounts.map(a => a.nome)).size).toBe(5);
    expect(spreadsheet.accounts.find(a => a.nome === "Nubank Pessoal")?.cor).toBe("#BC8EDE");
    expect(spreadsheet.accounts.find(a => a.nome === "Nubank Empresa")?.cor).toBe("#781F6E");
    expect(spreadsheet.accounts.find(a => a.nome === "Cartão da sogra")?.cor).toBe("#8FC7E8");
    expect(spreadsheet.accounts.find(a => a.nome === "Cartão da sogra")?.fechamento).toBeNull();
  });
  it("the actual SQL loader contains exactly the spreadsheet numeric rows", () => {
    const sql = readFileSync("drizzle/migrations/0003_november_2026_spreadsheet_loader.sql", "utf8");
    const tuples = [...sql.matchAll(/\('([^']+)',(\d+),'([^']*)',([\d.]+),'(Fixo|\d+)','([^']+)','(entrada|saida)',(true|false),(NULL::int|\d+)\)/g)];
    expect(tuples).toHaveLength(87);
    const actual = tuples.map(m => ({ conta: m[1], dia: Number(m[2]), descricao: m[3], valor: Number(m[4]), parcelas: m[5], categoria: m[6], tipo: m[7], bonificacao: m[8] === "true", ciclo: m[9] === "NULL::int" ? null : Number(m[9]) }));
    expect(actual).toEqual(spreadsheet.transactions);
  });
});