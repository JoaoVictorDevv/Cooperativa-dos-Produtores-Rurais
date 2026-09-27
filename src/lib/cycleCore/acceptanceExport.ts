import { z } from "zod";
import { ACCEPTANCE_CASES, CALCULATION_CASES } from "./acceptanceCases";
import { commandResultSchema, commandSchema } from "./commandSchema";
import { ledgerSchema } from "./ledgerSchema";

// Conteúdo exato dos arquivos de docs/aceitacao (determinístico).
export function acceptanceFiles(): Record<string, string> {
  const casos = {
    versao: 1,
    descricao:
      "Casos de aceitação da spec 008 (complementos, faltas, fechamento), do galpão e do arredondamento. " +
      "Cada caso: estado inicial (CycleLedger), passos (comandos com o resultado esperado) e expectativas finais. " +
      "Ids de evento são gerados em ordem: ev-1, ev-2, ... Perfil padrão: OPERADOR. Ver docs/aceitacao/README.md.",
    casos: ACCEPTANCE_CASES,
    calculos: CALCULATION_CASES,
  };
  const contrato = {
    $comment: "Gerado de src/lib/cycleCore/commandSchema.ts e ledgerSchema.ts (zod). Não editar à mão.",
    comando: z.toJSONSchema(commandSchema),
    resultado: z.toJSONSchema(commandResultSchema),
    estadoDoCiclo: z.toJSONSchema(ledgerSchema),
  };
  return {
    "docs/aceitacao/casos.json": JSON.stringify(casos, null, 2) + "\n",
    "docs/aceitacao/contrato-comandos.schema.json": JSON.stringify(contrato, null, 2) + "\n",
  };
}
