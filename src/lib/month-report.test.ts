import { describe, expect, it } from "vitest";
import spreadsheet from "./november-2026.json";
import { buildSeries, type Recorrencia, type Tx } from "./finance";
import { buildMonthReport, pdfText } from "./month-report";
import { renderMonthReportPdf } from "./month-report-pdf";

const settings = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const base: Tx[] = spreadsheet.transactions.flatMap((r, index) => {
  const recurrence: Recorrencia = r.parcelas === "Fixo" ? "fixa" : r.parcelas === "1" ? "unica" : "parcelada";
  return buildSeries({ tipo: r.tipo === "entrada" ? "entrada" : "saida", descricao: r.descricao, categoria_id: r.categoria,
    valor: r.valor, data_vencimento: `2026-11-${String(r.dia).padStart(2, "0")}`, pago: false, data_pagamento: null,
    conta_id: r.conta, nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null,
    recorrencia: recurrence, bonificacao: r.bonificacao, observacoes: null, ciclo: r.ciclo },
    { parcelasTotal: recurrence === "parcelada" ? Number(r.parcelas) : 1 }, String(index))
    .map((row, i) => ({ ...row, id: `${index}-${i}`, encerrada: false }));
});
const rows = base.map(t => ["Aluguel AP", "Luz"].includes(t.descricao) && t.data_vencimento.startsWith("2026-11") ? { ...t, pago: true, data_pagamento: "2026-11-08" } : t);
const categories = [...new Set(rows.map(r => r.categoria_id ?? ""))].map(n => ({ id: n, nome: n }));
const accounts = spreadsheet.accounts.map(a => ({ id: a.nome, nome: a.nome }));
const make = (txs: Tx[], month = "2026-11") => buildMonthReport({ txs, month, settings, categories, accounts, activeProvisionTxIds: new Set(), today: "2026-11-12" });
const r = make(rows);

describe("monthly PDF report data", () => {
  it("cycle 1 totals", () => {
    expect(r.c1.contas).toBeCloseTo(6599.995, 2);
    expect(r.c1.pago).toBeCloseTo(1846.6, 2);
    expect(r.c1.falta).toBeCloseTo(4753.395, 2);
    expect(r.c1.atrasado).toBeCloseTo(3102.675, 2);
    expect(r.c1.pctPago).toBeCloseTo(27.98, 2);
    expect(r.c1.restara).toBeCloseTo(967.005, 2);
  });
  it("cycle 2 totals with a single Mercado Mensal line", () => {
    expect(r.c2.contas).toBeCloseTo(7555.27, 2);
    expect(r.c2.pago).toBe(0);
    expect(r.c2.falta).toBeCloseTo(7555.27, 2);
    expect(r.c2.atrasado).toBe(0);
    expect(r.c2.restara).toBeCloseTo(11.73, 2);
    const market = r.c2.rows.filter(x => x.descricao === "Mercado Mensal");
    expect(market).toHaveLength(1);
    expect(market[0]?.valor).toBeCloseTo(1416.28, 2);
    expect(r.c2.rows.some(x => x.categoria === "Mercado" && x.descricao !== "Mercado Mensal")).toBe(false);
  });
  it("month total to save includes bonuses", () => {
    expect(r.restaraMes).toBeCloseTo(2978.735, 2);
    expect(r.bonificacoes).toBe(2000);
  });
  it("non-accounted items only appear in the annex", () => {
    const extra: Tx = { ...rows[0]!, id: "nc", descricao: "IA EXPERIENCE", valor: 355, nao_contabilizar: true, reembolso_de: "Time", data_vencimento: "2026-11-05", ciclo: null };
    const r2 = make([...rows, extra]);
    expect(r2.naoContabilizados).toEqual([{ descricao: "IA EXPERIENCE", reembolsoDe: "Time", valor: 355, recebido: false }]);
    for (const k of ["contas", "pago", "falta", "restaraMes", "entradas"] as const) expect(r2[k]).toBeCloseTo(r[k], 6);
    expect(r2.c1.atrasado).toBeCloseTo(r.c1.atrasado, 6);
    expect([...r2.c1.rows, ...r2.c2.rows].some(x => x.id === "nc")).toBe(false);
  });
  it("incomes do not count in amount left to pay", () => {
    expect(r.falta).toBeCloseTo(4753.395 + 7555.27, 2);
    expect(r.incomes).toHaveLength(4);
  });
  it("empty month renders a valid PDF with a message", () => {
    const e = make([], "2027-05");
    expect(e.empty).toBe(true);
    const out = renderMonthReportPdf(e).output();
    expect(out.startsWith("%PDF")).toBe(true);
    expect(out).toContain("Nenhum lan");
  });
  it("keeps Portuguese accents and R$, replaces non Latin-1 symbols", () => {
    expect(pdfText("Ação ção é õ ô R$ 1,00")).toBe("Ação ção é õ ô R$ 1,00");
    expect(pdfText("−R$ 5 ▾ → •")).toBe("-R$ 5 v -> -");
    const doc = renderMonthReportPdf(r);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });
});
