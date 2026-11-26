import { describe, expect, it } from "vitest";
import { reportFixture } from "./report-fixture";
import {
  actualTotals,
  compareExpectedTotals,
  emptyExpectedTotals,
  parseAiAnalysis,
  type ExpectedTotals,
} from "./reconciliation";

const fixture = reportFixture();
const input = { ...fixture, month: "2026-11", today: "2026-11-12" };
const actual = actualTotals(input);

function expected(values: Partial<ExpectedTotals>): ExpectedTotals {
  return { ...emptyExpectedTotals(), ...values };
}

describe("conferência de totais esperados", () => {
  it("usa os mesmos totais exatos dos relatórios existentes", () => {
    expect(actual.ciclo1Contas).toBeCloseTo(6599.995, 6);
    expect(actual.ciclo2Contas).toBeCloseTo(7555.27, 6);
    expect(actual.totalGuardar).toBeCloseTo(2978.735, 6);
    expect(actual.jessicaTotal).toBeCloseTo(2654.72, 6);
    expect(actual.jessicaPendente).toBeCloseTo(2654.72, 6);
    expect(actual.reembolsosTotal).toBeCloseTo(420.60, 6);
    expect(actual.reembolsosPendente).toBeCloseTo(355, 6);
    expect(actual.reembolsosRecebido).toBeCloseTo(65.60, 6);
  });

  it("compara apenas campos preenchidos e calcula app menos esperado", () => {
    const result = compareExpectedTotals("2026-11", actual, expected({ ciclo1Contas: 6500, jessicaPendente: 2700 }));
    expect(result.comparisons).toHaveLength(2);
    expect(result.comparisons[0]?.difference).toBeCloseTo(99.995, 6);
    expect(result.comparisons[1]?.difference).toBeCloseTo(-45.28, 6);
    expect(result.divergenceCount).toBe(2);
  });

  it("considera reconciliados valores iguais depois do mesmo arredondamento do dashboard", () => {
    const result = compareExpectedTotals("2026-11", actual, expected({ ciclo1Contas: 6600, totalGuardar: 2978.74 }));
    expect(result.divergenceCount).toBe(0);
    expect(result.comparisons.every(row => row.matches)).toBe(true);
    expect(result.comparisons[0]?.difference).toBeCloseTo(-0.005, 6);
  });

  it("não altera os lançamentos ao montar a conferência", () => {
    const before = JSON.stringify(fixture.txs);
    actualTotals(input);
    expect(JSON.stringify(fixture.txs)).toBe(before);
  });

  it("valida a análise e descarta IDs que não pertencem aos lançamentos enviados", () => {
    const valid = crypto.randomUUID();
    const parsed = parseAiAnalysis({
      resumo: "Há uma diferença a investigar.",
      suspeitas: [
        { transactionId: valid, metricKey: "ciclo1Contas", explicacao: "Este item pode explicar a diferença.", impacto: 100, confianca: "media" },
        { transactionId: crypto.randomUUID(), metricKey: "ciclo1Contas", explicacao: "ID inventado.", impacto: 1, confianca: "baixa" },
      ],
      verificacoes: ["Confira o relatório original."],
    }, new Set([valid]));
    expect(parsed.suspeitas).toHaveLength(1);
    expect(parsed.suspeitas[0]?.transactionId).toBe(valid);
  });
});
