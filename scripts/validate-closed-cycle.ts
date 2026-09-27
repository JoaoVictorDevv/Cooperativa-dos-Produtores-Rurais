// Valida um ciclo FECHADO: compara o modelo atual com a lógica corrigida na
// parte do galpão (recebimento, rejeição, a pagar), custos e diferença.
// SÓ LÊ: a conexão é aberta com default_transaction_read_only=on e o script
// confere isso no servidor antes de ler qualquer dado. Nunca imprime a URL.
//
// Uso (por quem tem acesso ao banco; nada é gravado):
//   VALIDATION_DATABASE_URL="postgresql://..." npx tsx scripts/validate-closed-cycle.ts --semana 12 [--saida relatorio.md]
//   (sem --semana: o ciclo fechado mais recente; --id <weekId> também funciona)
// Saída: 0 = confere; 1 = divergência ou anomalia; 2 = erro/recusa.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env"), quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const raw = process.env.VALIDATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) {
    console.error("Defina VALIDATION_DATABASE_URL (ou DATABASE_URL).");
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

  // Importados depois de fixar a URL somente leitura (o cliente é criado no import).
  const { prisma } = await import("../src/lib/prisma");
  const { getWeekFinancialSummary, getWarehouseDifferenceLines } = await import("../src/lib/weekSummary");
  const { loadCurrentCycle } = await import("../src/lib/cycleCore/currentTables");
  const { compareGalpao, parityMarkdown } = await import("../src/lib/cycleCore/galpaoParity");

  try {
    const [ro] = await prisma.$queryRawUnsafe<{ default_transaction_read_only: string }[]>("SHOW default_transaction_read_only");
    if (ro?.default_transaction_read_only !== "on") {
      console.error("Não foi possível garantir conexão somente leitura; nada foi lido.");
      return 2;
    }
    console.error(`Conexão somente leitura confirmada (servidor ${url.hostname}, banco ${url.pathname.slice(1)}).`);

    const id = arg("id");
    const number = arg("semana");
    const week = id
      ? await prisma.week.findUnique({ where: { id } })
      : number
        ? await prisma.week.findFirst({ where: { number: Number(number), status: "FECHADA" }, orderBy: { startDate: "desc" } })
        : await prisma.week.findFirst({ where: { status: "FECHADA" }, orderBy: { startDate: "desc" } });
    if (!week) {
      console.error("Ciclo fechado não encontrado.");
      return 2;
    }
    if (week.status !== "FECHADA") {
      console.error(`O ciclo ${week.number} não está fechado; a validação é só para ciclos fechados.`);
      return 2;
    }

    const [summary, differenceLines, current] = await Promise.all([getWeekFinancialSummary(week.id), getWarehouseDifferenceLines(week.id), loadCurrentCycle(prisma, week.id)]);
    if (!current) throw new Error("Ciclo sumiu durante a leitura.");
    const report = compareGalpao(
      {
        producerLines: summary.producerLines,
        producersTotal: summary.producersTotal,
        totalCosts: summary.totalCosts,
        differenceLines,
        treasuryTotal: summary.treasuryTotal,
        treasuryRounding: summary.treasuryRounding,
      },
      current,
    );
    const range = `${week.startDate.toISOString().slice(0, 10)} a ${week.endDate.toISOString().slice(0, 10)}`;
    const md = parityMarkdown(report, `Validação do ciclo ${week.number} (${range}, fechado) — galpão, custos e diferença`);
    const out = arg("saida");
    if (out) writeFileSync(out, md);
    console.log(md);
    return report.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message.split("\n")[0] : "Erro na validação.");
    process.exit(2);
  },
);
