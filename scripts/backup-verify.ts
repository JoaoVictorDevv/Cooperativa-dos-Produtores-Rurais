// Verificação de backup/restauração SÓ LEITURA (etapa 6; docs/backup-e-restauracao.md).
// Nunca use a suíte de testes (npm run test:integration) numa cópia restaurada:
// ela apaga dados. Este script abre a conexão com default_transaction_read_only=on
// e confere isso no servidor antes de ler. Nunca imprime a URL.
//
//   1) Na ORIGEM, logo antes do dump:
//      VERIFY_DATABASE_URL="postgresql://.../origem" npx tsx scripts/backup-verify.ts --salvar origem.json
//   2) Na CÓPIA restaurada (banco NOVO, nunca por cima da origem):
//      VERIFY_DATABASE_URL="postgresql://.../copia"  npx tsx scripts/backup-verify.ts --comparar origem.json
// Saída: 0 = idêntico; 1 = diferenças; 2 = erro/recusa.

import { readFileSync, writeFileSync } from "node:fs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const save = arg("salvar");
  const compare = arg("comparar");
  if (!save === !compare) {
    console.error("Use --salvar <arquivo.json> (origem) ou --comparar <arquivo.json> (cópia restaurada).");
    return 2;
  }
  const raw = process.env.VERIFY_DATABASE_URL;
  if (!raw) {
    console.error("Defina VERIFY_DATABASE_URL (o banco a verificar).");
    return 2;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.error("URL do banco ilegível.");
    return 2;
  }
  url.searchParams.set("options", "-c default_transaction_read_only=on");
  process.env.DATABASE_URL = url.toString();

  const { prisma } = await import("../src/lib/prisma");
  const { getWeekFinancialSummary } = await import("../src/lib/weekSummary");
  const { buildFingerprint, compareFingerprints } = await import("../src/lib/backup/fingerprint");
  try {
    const [ro] = await prisma.$queryRawUnsafe<{ default_transaction_read_only: string }[]>("SHOW default_transaction_read_only");
    if (ro?.default_transaction_read_only !== "on") {
      console.error("Não foi possível garantir conexão somente leitura; nada foi lido.");
      return 2;
    }
    console.error(`Conexão somente leitura confirmada (banco ${url.pathname.slice(1)}).`);
    const fp = await buildFingerprint(prisma, getWeekFinancialSummary);
    const total = Object.values(fp.tables).reduce((a, t) => a + t.rows, 0);
    console.log(`Tabelas: ${Object.keys(fp.tables).length} · linhas: ${total} · ciclos: ${fp.weeks.length} · migrações: ${fp.migrations.length}`);
    const problems = Object.entries(fp.integrity).filter(([, n]) => n > 0);
    for (const [label, n] of problems) console.log(`Atenção (integridade): ${label}: ${n}`);
    if (save) {
      writeFileSync(save, JSON.stringify(fp, null, 2));
      console.log(`Impressão digital salva em ${save}.`);
      return 0;
    }
    const source = JSON.parse(readFileSync(compare!, "utf8"));
    const diff = compareFingerprints(source, fp);
    if (diff.ok) {
      console.log("Cópia IDÊNTICA à origem: mesmas tabelas, linhas, conteúdo (hash), integridade e totais de cada ciclo.");
      return 0;
    }
    console.log(`Cópia DIFERENTE da origem (${diff.differences.length}):`);
    for (const d of diff.differences) console.log(`- ${d}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message.split("\n")[0] : "Erro na verificação.");
    process.exit(2);
  },
);
