import { z } from "zod";

// Colunas Decimal(10,2) e Decimal(12,2): até 2 casas. Valor com mais casas era
// arredondado em silêncio pelo banco (1,005 → 1,01); agora é recusado com
// mensagem (revisão de segurança, 27/09/2026 — "não arredondar silenciosamente").
const twoDecimals = (v: number) => Math.abs(Math.round(v * 100) / 100 - v) < 1e-9;

// CA-PED-ESC-02/03, CA-DEV-07: zero e permitido, negativo nunca.
export const qtySchema = z.coerce
  .number({ error: "Informe um numero" })
  .min(0, "Quantidade nao pode ser negativa")
  .max(99_999_999.99, "Quantidade grande demais")
  .refine(twoDecimals, "Use no maximo 2 casas decimais");

export const moneySchema = z.coerce
  .number({ error: "Informe um valor" })
  .min(0, "Valor nao pode ser negativo")
  .max(9_999_999_999.99, "Valor grande demais")
  .refine(twoDecimals, "Use no maximo 2 casas decimais");
