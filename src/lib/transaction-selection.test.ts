import { describe, expect, it } from "vitest";
import { selectionSummary, toggleSelection } from "./transaction-selection";

describe("transaction selection", () => {
  it("sums outgoing values in cents", () => {
    const result = selectionSummary([{ tipo: "saida", valor: 0.1 }, { tipo: "saida", valor: 0.2 }]);
    expect(result.saidasCentavos).toBe(30);
    expect(result.totalCentavos).toBe(30);
    expect(result.misturada).toBe(false);
  });
  it("sums incoming values", () => {
    const result = selectionSummary([{ tipo: "entrada", valor: 8067 }, { tipo: "entrada", valor: 1000 }]);
    expect(result.entradasCentavos).toBe(906700);
    expect(result.saldoCentavos).toBe(906700);
  });
  it("separates mixed types and subtracts outgoing from incoming", () => {
    const result = selectionSummary([{ tipo: "entrada", valor: 100 }, { tipo: "saida", valor: 150.25 }]);
    expect(result).toEqual({ quantidade: 2, saidasCentavos: 15025, entradasCentavos: 10000, saldoCentavos: -5025, totalCentavos: 25025, misturada: true });
  });
  it("preserves three decimals until rounding the sum to cents", () => {
    expect(selectionSummary([{ tipo: "saida", valor: 907.255 }, { tipo: "saida", valor: 49.625 }]).saidasCentavos).toBe(95688);
  });
  it("returns zero for an empty selection", () => {
    expect(selectionSummary([])).toEqual({ quantidade: 0, saidasCentavos: 0, entradasCentavos: 0, saldoCentavos: 0, totalCentavos: 0, misturada: false });
  });
  it("bulk selection retains hidden rows and unchecking only removes the visible group", () => {
    const selected = toggleSelection(new Set(["hidden"]), ["a", "b"], true);
    expect([...selected]).toEqual(["hidden", "a", "b"]);
    expect([...toggleSelection(selected, ["a", "b"], false)]).toEqual(["hidden"]);
  });
});