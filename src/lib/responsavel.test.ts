import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import spreadsheet from "./november-2026.json";
import jessica from "./jessica-2026.json";
import { buildSeries, cycleSummaries, invoicePartition, parseResponsavel, personalTransactions, projection, sum, type Tx } from "./finance";
import { defaultAssumptions, extendProjectionFixed, projectCycles } from "./cycle-projection";
import { buildMonthReport } from "./month-report";
import { provisionEligible } from "./provisions";

const settings = { orcamento_mercado: 1200, lazer_por_ciclo: 500, dia_corte_ciclo: 24, dia_fechamento_cartao: 26 };
const base = { pago: false, data_pagamento: null, nao_contabilizar: false, reembolso_de: null, recebido: false, recebido_em: null, observacoes: null, bonificacao: false };
const felipe: Tx[] = spreadsheet.transactions.flatMap((r, n) => buildSeries({ ...base, responsavel: "Felipe", tipo: r.tipo === "entrada" ? "entrada" : "saida", descricao: r.descricao, categoria_id: r.categoria, conta_id: r.conta, valor: r.valor, data_vencimento: `2026-11-${String(r.dia).padStart(2,"0")}`, recorrencia: r.parcelas === "Fixo" ? "fixa" : r.parcelas === "1" ? "unica" : "parcelada", bonificacao: r.bonificacao, ciclo: r.ciclo }, { parcelasTotal: Number(r.parcelas) || 1 }, `f-${n}`).map((t,i) => ({ ...t, id: `f-${n}-${i}`, encerrada: false })));
const hers: Tx[] = jessica.flatMap((r,n) => buildSeries({ ...base, responsavel: "Jéssica", tipo: "saida", descricao: r.descricao, categoria_id: r.categoria, conta_id: r.conta, valor: r.valor, data_vencimento: "2026-11-26", recorrencia: r.atual === 0 ? "fixa" : r.total > 1 ? "parcelada" : "unica" }, { parcelasTotal: r.total, parcelasPagas: Math.max(0,r.atual-1) }, `j-${n}`).map((t,i) => ({ ...t, id: `j-${n}-${i}`, encerrada: false })));
const all = [...felipe,...hers];
const accounts = spreadsheet.accounts.map(a => ({ id:a.nome, nome:a.nome, tipo:a.tipo === "cartao_credito" ? "cartao_credito" as const : "conta_corrente" as const }));
const categories = [...new Set(felipe.map(t => t.categoria_id ?? ""))].map(n => ({id:n,nome:n}));
const first = hers[0];
if (!first) throw new Error("Missing Jéssica fixture");
describe("responsible accounting", () => {
  it("keeps Felipe C1 bills 6599.995 and savings 967.005", () => {
    const c = cycleSummaries(all,"2026-11",settings,"Mercado");
    expect(c.c1.contas).toBeCloseTo(6599.995,6); expect(c.c1.restou).toBeCloseTo(967.005,6);
  });
  it("keeps Felipe C2 bills 7555.27 and savings 11.73", () => {
    const c = cycleSummaries(all,"2026-11",settings,"Mercado");
    expect(c.c2.contas).toBeCloseTo(7555.27,6); expect(c.c2.restou).toBeCloseTo(11.73,6);
  });
  it("keeps total savings 2978.735 and market 1416.28", () => {
    const c = cycleSummaries(all,"2026-11",settings,"Mercado");
    expect(c.totalGuardar).toBeCloseTo(2978.735,6); expect(c.mercado).toBe(1416.28);
  });
  it("loads 28 November charges: Empresa 2623.82 and Pessoal 30.90", () => {
    const month=hers.filter(t=>t.data_vencimento.startsWith("2026-11"));
    expect(month).toHaveLength(28); expect(sum(month)).toBe(2654.72);
    expect(sum(month.filter(t=>t.conta_id==="Nubank Empresa"))).toBe(2623.82);
    expect(sum(month.filter(t=>t.conta_id==="Nubank Pessoal"))).toBe(30.90);
  });
  for (const [month,total] of [["2026-12",1126.07],["2027-01",638.38],["2027-02",638.38],["2027-03",488.38],["2027-04",96.43]] as const) {
    it(`Jéssica ${month} equals ${total}`,()=>expect(sum(hers.filter(t=>t.data_vencimento.startsWith(month)))).toBe(total));
  }
  it("excludes Jéssica from projections and variable-card estimates", () => {
    const a=defaultAssumptions(felipe,"2026-11",settings,"Mercado",accounts);
    expect(defaultAssumptions(all,"2026-11",settings,"Mercado",accounts)).toEqual(a);
    expect(projectCycles(all,"2026-11",12,settings,"Mercado",a).map(m=>m.cycles)).toEqual(projectCycles(felipe,"2026-11",12,settings,"Mercado",a).map(m=>m.cycles));
    expect(projection(all,"2026-11",12,settings,"Mercado")).toEqual(projection(felipe,"2026-11",12,settings,"Mercado"));
  });
  it("excludes Jéssica market and category-budget spending", () => {
    const market={...first,id:"her-market",categoria_id:"Mercado",valor:9000};
    expect(cycleSummaries([...all,market],"2026-11",settings,"Mercado").mercado).toBe(1416.28);
    expect(sum(personalTransactions(all).filter(t=>t.categoria_id==="Saúde"))).toBe(sum(felipe.filter(t=>t.categoria_id==="Saúde")));
  });
  it("monthly PDF excludes Jéssica including excluded Jéssica annex items", () => {
    const make=(txs:Tx[])=>buildMonthReport({txs,month:"2026-11",settings,categories,accounts,activeProvisionTxIds:new Set(),today:"2026-11-12"});
    const { outside, ...personalReport } = make([...all,{...first,id:"her-excluded",nao_contabilizar:true}]);
    const { outside: baselineOutside, ...baselineReport } = make(felipe);
    expect(personalReport).toEqual(baselineReport);
    expect(baselineOutside).toEqual({total:0,reembolsos:0,jessica:0});
    expect(outside).toEqual({total:2949.96,reembolsos:0,jessica:2949.96});
    const excludedFelipe = {...first,id:"felipe-reimbursement",responsavel:"Felipe" as const,descricao:"EXCLUSIVO REEMBOLSO FELIPE",valor:420.60,nao_contabilizar:true};
    const { outside: withOutside, naoContabilizados, ...withReimbursement } = make([...all,excludedFelipe]);
    const { naoContabilizados: baselineAnnex, ...baselinePersonal } = baselineReport;
    expect(withReimbursement).toEqual(baselinePersonal);
    expect(baselineAnnex).toEqual([]);
    expect(naoContabilizados.map(t=>t.descricao)).toEqual(["EXCLUSIVO REEMBOLSO FELIPE"]);
    expect(withOutside).toEqual({total:3075.32,reembolsos:420.60,jessica:2654.72});
  });
  it("Jéssica is ineligible for provision, Felipe becomes eligible",()=>{
    expect(provisionEligible(first)).toBe(false); expect(provisionEligible({...first,responsavel:"Felipe"})).toBe(true);
  });
  it("changing responsible to Felipe restores accounting",()=>{
    expect(personalTransactions([first])).toEqual([]);
    const changed={...first,responsavel:"Felipe" as const};
    expect(personalTransactions([changed])).toEqual([changed]);
    expect(cycleSummaries([changed],"2026-11",settings,null).c2.contas).toBe(1495.24);
  });
  it("excluded Jéssica is counted once in invoice company bucket",()=>{
    const excluded={...first,nao_contabilizar:true,recebido:true};
    expect(personalTransactions([excluded])).toEqual([]);
    expect(invoicePartition([excluded])).toEqual({total:295.24,felipe:0,jessica:0,empresa:295.24});
  });
  it("invoice parts sum exactly to the total",()=>{
    const rows=all.filter(t=>t.data_vencimento.startsWith("2026-11")&&t.conta_id==="Nubank Empresa");
    const p=invoicePartition(rows);
    expect(p.jessica).toBe(2623.82); expect(sum([{valor:p.felipe},{valor:p.jessica},{valor:p.empresa}])).toBe(p.total);
  });
  it("fixed and installment generation preserves responsible/current fraction",()=>{
    expect(hers.every(t=>t.responsavel==="Jéssica")).toBe(true);
    expect(hers.find(t=>t.descricao==="Desumidificador")?.parcela_atual).toBe(2);
    expect(hers.find(t=>t.descricao==="Belasmeias"&&t.data_vencimento.startsWith("2026-12"))?.parcela_atual).toBe(2);
    expect(extendProjectionFixed(hers,"2028-01").filter(t=>t.descricao==="Supercoffe").every(t=>t.responsavel==="Jéssica")).toBe(true);
  });
  it("CSV responsible defaults to Felipe and rejects invalid values",()=>{
    expect(parseResponsavel(undefined)).toBe("Felipe"); expect(parseResponsavel("Jéssica")).toBe("Jéssica"); expect(()=>parseResponsavel("Other")).toThrow();
  });
  it("applied SQL loader matches all 28 numeric fixture rows",()=>{
    const sql=readFileSync("drizzle/migrations/0007_transaction_responsible_and_jessica_loader.sql","utf8");
    const rows=[...sql.matchAll(/\((\d+),'([^']+)',([\d.]+),(\d+),(\d+),'([^']+)'\)/g)].map(m=>({descricao:m[2],valor:Number(m[3]),atual:Number(m[4]),total:Number(m[5]),categoria:m[6],conta:Number(m[1])===28?"Nubank Pessoal":"Nubank Empresa"}));
    expect(rows).toEqual(jessica);
  });
});