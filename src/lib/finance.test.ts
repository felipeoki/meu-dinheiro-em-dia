import { describe, expect, it } from "vitest";
import { buildSeries, cycleSummaries, envelopeStatus, faturaMonth, fmtBRL, mercadoMensal, parseValor, type Tx } from "./finance";

const S = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const tx = (p: Partial<Tx>): Tx => ({
  id: Math.random().toString(), tipo: "saida", descricao: "", categoria_id: null, valor: 0,
  data_vencimento: "2026-10-08", pago: false, data_pagamento: null, forma_pagamento: "Conta",
  recorrencia: "unica", parcela_atual: null, parcelas_total: null, grupo_id: null, ciclo: null,
  bonificacao: false, encerrada: false, observacoes: null, ...p,
});

describe("finance rules", () => {
  it("formats BRL", () => expect(fmtBRL(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56"));
  it("Setembro market total 1680,80 overflows by 480,80", () => {
    const vals = [85.86,167.66,386.89,138.71,126.8,53,125.68,72.86,15,40.86,15,15,62.15,79.77,20.93,42.29,100.35,15,25,61.99,30];
    const total = vals.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1680.8, 2);
    expect(total - 1200).toBeCloseTo(480.8, 2);
    expect(envelopeStatus(total, 1200)).toBe("estourou");
  });
  it("yellow alert at 80%", () => expect(envelopeStatus(960, 1200)).toBe("alerta"));
  it("mercado counts budget while below it", () => expect(mercadoMensal(300, 1200)).toBe(1200));
  it("cycles: day 23 is ciclo 1, day 24 ciclo 2; liquido/restou/total", () => {
    const txs = [
      tx({ tipo: "entrada", valor: 8067, ciclo: 1 }),
      tx({ tipo: "entrada", valor: 8067, ciclo: 2, data_vencimento: "2026-10-22" }),
      tx({ tipo: "entrada", valor: 1000, ciclo: 1, bonificacao: true }),
      tx({ tipo: "entrada", valor: 1000, ciclo: 2, bonificacao: true }),
      tx({ valor: 100, data_vencimento: "2026-10-23" }),
      tx({ valor: 200, data_vencimento: "2026-10-24" }),
    ];
    const r = cycleSummaries(txs, "2026-10", S, "merc");
    expect(r.c1.contas).toBe(100);
    expect(r.c2.contas).toBe(200 + 1200);
    expect(r.c1.restou).toBe(8067 - 100 - 500);
    expect(r.totalGuardar).toBe(r.c1.restou + r.c2.restou + 2000);
  });
  it("card purchase after closing day goes to next invoice", () => {
    expect(faturaMonth("2026-10-26", 26)).toBe("2026-10");
    expect(faturaMonth("2026-10-27", 26)).toBe("2026-11");
  });
  it("parcelada with 91 remaining creates 91 rows", () => {
    const rows = buildSeries({ tipo: "saida", descricao: "FIES", categoria_id: null, valor: 478.31, data_vencimento: "2026-10-24", pago: false, data_pagamento: null, forma_pagamento: "Conta", recorrencia: "parcelada", bonificacao: false, observacoes: null }, { parcelasTotal: 91, parcelasPagas: 0 }, "g");
    expect(rows).toHaveLength(91);
    expect(rows[1]?.data_vencimento).toBe("2026-11-24");
  });
  it("parses BR values", () => expect(parseValor("1.041,67")).toBe(1041.67));
});
