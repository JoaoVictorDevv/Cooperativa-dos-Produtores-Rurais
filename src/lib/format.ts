// Formatacao de quantidade. A maioria dos produtos e vendida em kg, mas
// Ovos e vendido em duzia (dz) — nunca assumir kg para todo mundo.
const DOZEN_PRODUCT_SLUGS = new Set(["ovos"]);

export function productUnit(productSlug?: string | null): "kg" | "dz" {
  return productSlug && DOZEN_PRODUCT_SLUGS.has(productSlug) ? "dz" : "kg";
}

// Numero limpo: sem decimais quando a quantidade e inteira (120, nao 120.00).
export function formatQtyNumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",");
}

// Quantidade com unidade certa por produto (120 kg / 10 dz).
export function formatQty(value: number, productSlug?: string | null): string {
  return `${formatQtyNumber(value)} ${productUnit(productSlug)}`;
}
