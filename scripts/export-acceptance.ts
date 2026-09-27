// Gera o pacote de aceitação para a API Java (docs/aceitacao/). Rodar depois de
// mudar os casos ou o contrato: npx tsx scripts/export-acceptance.ts
// O teste acceptanceCases.test.ts falha se os arquivos ficarem desatualizados.
import { writeFileSync } from "node:fs";
import { acceptanceFiles } from "../src/lib/cycleCore/acceptanceExport";

for (const [path, content] of Object.entries(acceptanceFiles())) {
  writeFileSync(path, content);
  console.log(`gravado ${path}`);
}
