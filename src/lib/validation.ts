import { z } from "zod";

// CA-PED-ESC-02/03, CA-DEV-07: zero e permitido, negativo nunca.
export const qtySchema = z.coerce
  .number({ error: "Informe um numero" })
  .min(0, "Quantidade nao pode ser negativa");

export const moneySchema = z.coerce.number({ error: "Informe um valor" }).min(0, "Valor nao pode ser negativo");
