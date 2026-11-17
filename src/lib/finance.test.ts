import { describe, expect, it } from "vitest";
import { projection, personalTransactions, invoiceSummary, installmentEnd, PROJECTION_HORIZONS, buildSeries, cycleSummaries, envelopeStatus, faturaMonth, fmtBRL, mercadoMensal, parseValor, type Tx } from "./finance";

const S = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const tx = (p: Partial<Tx>): Tx => ({
  id: Math.random().toString(), tipo: "saida", descricao: "", categoria_id: null, valor: 0,
  data_vencimento: "2026-10-08", pago: false, data_pagamento: null, conta_id: null, responsavel: "Felipe", nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null,
  recorrencia: "unica", parcela_atual: null, parcelas_total: null, grupo_id: null, ciclo: null,
  bonificacao: false, encerrada: false, observacoes: null, ...p,
});

describe("finance rules", () => {
  it("formats BRL", () => expect(fmtBRL(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56"));
  it("November market total 1416,28 overflows by 216,28", () => {
    const vals = [126.8,60,26.99,442.49,15,88.59,40.77,24,158.22,66.96,114.85,119.72,31.38,35,65.51];
    const total = vals.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1416.28, 2);
    expect(total - 1200).toBeCloseTo(216.28, 2);
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
    const rows = buildSeries({ tipo: "saida", descricao: "FIES", categoria_id: null, valor: 478.31, data_vencimento: "2026-10-24", pago: false, data_pagamento: null, conta_id: null, responsavel: "Felipe", nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null, recorrencia: "parcelada", bonificacao: false, observacoes: null }, { parcelasTotal: 91, parcelasPagas: 0 }, "g");
    expect(rows).toHaveLength(91);
    expect(rows[1]?.data_vencimento).toBe("2026-11-24");
  });
  it("parses BR values", () => expect(parseValor("1.041,67")).toBe(1041.67));
});

describe("reimbursements and projection", () => {
  it("excluded rows never affect personal sums even after receiving", () => {
    const base=[tx({valor:100}),tx({tipo:"entrada",valor:1000})];
    const excluded=[tx({valor:450,nao_contabilizar:true}),tx({tipo:"entrada",valor:200,nao_contabilizar:true,recebido:true})];
    expect(personalTransactions([...base,...excluded])).toEqual(base);
    expect(cycleSummaries([...base,...excluded],"2026-10",S,null)).toEqual(cycleSummaries(base,"2026-10",S,null));
    expect(projection([...base,...excluded],"2026-10",12,S,null).totals).toEqual(projection(base,"2026-10",12,S,null).totals);
  });
  it("market reimbursements do not increase the market envelope", () => {
    const p=projection([tx({valor:300,categoria_id:"merc"}),tx({valor:2000,categoria_id:"merc",nao_contabilizar:true})],"2026-10",12,S,"merc");
    expect(p.totals[0]?.mercado).toBe(1200);
    expect(cycleSummaries([tx({valor:2000,categoria_id:"merc",nao_contabilizar:true})],"2026-10",S,"merc").mercado).toBe(1200);
  });
  it("bank charges include reimbursements; sua parte subtracts only pending reimbursement", () => {
    expect(invoiceSummary([tx({valor:100}),tx({valor:50,nao_contabilizar:true}),tx({valor:20,nao_contabilizar:true,recebido:true})])).toEqual({total:170,receber:50,suaParte:120});
  });
  it("FIES with 91 installments starting October 2026 ends April 2034", () => {
    expect(installmentEnd(tx({recorrencia:"parcelada",parcela_atual:1,parcelas_total:91}))).toBe("2034-04");
  });
  it("monthly outgoing total uses one market envelope and drops ended installments", () => {
    const rows=[tx({valor:100,grupo_id:"g",recorrencia:"parcelada",parcela_atual:1,parcelas_total:1}),tx({valor:1000,tipo:"entrada"}),tx({valor:300,categoria_id:"merc"})];
    const p=projection(rows,"2026-10",12,S,"merc");
    expect(p.totals[0]).toEqual({mes:"2026-10",saidas:1300,entradas:1000,saldo:-300,mercado:1200});
    expect(p.totals[1]?.saidas).toBe(1200);
    expect(p.endings[0]?.liberado).toBe(100);
    expect(p.endings[0]?.acumulado).toBe(100);
  });
  it("released monthly value accumulates across ending installments", () => {
    const p=projection([tx({valor:100,grupo_id:"a",recorrencia:"parcelada",parcela_atual:1,parcelas_total:1}),tx({valor:250,grupo_id:"b",recorrencia:"parcelada",parcela_atual:1,parcelas_total:2})],"2026-10",12,S,null);
    expect(p.endings.map(r=>r.acumulado)).toEqual([100,350]);
  });
  it("allowed horizons are 12,18,24,36, starting with selected month", () => {
    expect(PROJECTION_HORIZONS).toEqual([12,18,24,36]);
    for(const n of PROJECTION_HORIZONS) {
      const p=projection([],"2026-10",n,S,null);
      expect(p.months).toHaveLength(n);
      expect(p.months[0]).toBe("2026-10");
    }
  });
});
