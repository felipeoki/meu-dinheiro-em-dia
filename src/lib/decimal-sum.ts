/** Add decimal source values without rounding intermediate amounts. */
export function decimalSum(values: number[]): number {
  const parts = values.map(value => {
    const [mantissa = "0", exponent = "0"] = String(value).toLowerCase().split("e");
    const [whole = "0", fraction = ""] = mantissa.split(".");
    return { units: BigInt(whole + fraction), scale: fraction.length - Number(exponent) };
  });
  const scale = Math.max(0, ...parts.map(part => part.scale));
  const units = parts.reduce((total, part) => total + part.units * 10n ** BigInt(scale - part.scale), 0n);
  return Number(units) / 10 ** scale;
}