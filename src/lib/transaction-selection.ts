import { fmtBRL, fmtDate, monthLabel, type Tx } from "./finance";

/** Sum decimal source values exactly, then round the combined amount to cents. */
export function selectionSummary(rows: Pick<Tx, "tipo" | "valor">[]) {
  const decimals = rows.map((row) => {
    const [mantissa = "0", exponent = "0"] = String(row.valor).toLowerCase().split("e");
    const [whole = "0", fraction = ""] = mantissa.split(".");
    const scale = fraction.length - Number(exponent);
    return { tipo: row.tipo, units: BigInt(whole + fraction), scale };
  });
  const scale = Math.max(2, ...decimals.map((row) => row.scale));
  let outgoing = 0n;
  let incoming = 0n;
  for (const row of decimals) {
    const value = row.units * 10n ** BigInt(scale - row.scale);
    if (row.tipo === "saida") outgoing += value;
    else incoming += value;
  }
  const divisor = 10n ** BigInt(scale - 2);
  const cents = (value: bigint) => Number((value + divisor / 2n) / divisor);
  const saidasCentavos = cents(outgoing);
  const entradasCentavos = cents(incoming);
  return {
    quantidade: rows.length,
    saidasCentavos,
    entradasCentavos,
    saldoCentavos: entradasCentavos - saidasCentavos,
    totalCentavos: cents(outgoing + incoming),
    misturada: rows.some((row) => row.tipo === "saida") && rows.some((row) => row.tipo === "entrada"),
  };
}

export function toggleSelection(current: ReadonlySet<string>, ids: string[], checked: boolean) {
  const next = new Set(current);
  for (const id of ids) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function selectionWhatsAppText(rows: Tx[], month: string) {
  const summary = selectionSummary(rows);
  const lines = rows.map((row) =>
    `• ${fmtDate(row.data_vencimento)} — ${row.descricao || "Sem descrição"} — ${fmtBRL(row.valor)} (${row.tipo === "entrada" ? "Entrada" : "Saída"})${row.nao_contabilizar ? " · Não contabilizar" : ""}`,
  );
  const totals = summary.misturada
    ? [`Saídas: ${fmtBRL(summary.saidasCentavos / 100)}`, `Entradas: ${fmtBRL(summary.entradasCentavos / 100)}`, `Saldo: ${fmtBRL(summary.saldoCentavos / 100)}`]
    : [`Soma: ${fmtBRL(summary.totalCentavos / 100)}`];
  return [`*Lançamentos — ${monthLabel(month)}*`, "", ...lines, "", `${summary.quantidade} lançamento${summary.quantidade === 1 ? "" : "s"}`, ...totals].join("\n");
}