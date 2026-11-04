// "Impressão digital" do banco para verificar uma restauração (etapa 6;
// docs/backup-e-restauracao.md). SÓ LÊ. Não depende de dados em memória nem de
// PDFs: compara, tabela por tabela, a quantidade de linhas e um hash do
// conteúdo, mais checagens de integridade e os totais de cada ciclo.
// Nunca inclui dados pessoais nem a URL do banco na saída — só contagens,
// hashes e totais.

import type { PrismaClient } from "@prisma/client";

export interface WeekTotals {
  number: number;
  status: string;
  startDate: string;
  treasuryTotal: number;
  producersTotal: number;
  totalCosts: number;
  balance: number;
}

export interface Fingerprint {
  version: 1;
  generatedAt: string;
  migrations: string[];
  tables: Record<string, { rows: number; hash: string }>;
  integrity: Record<string, number>;
  weeks: WeekTotals[];
}

type Db = Pick<PrismaClient, "$queryRawUnsafe" | "week">;
type Summarize = (weekId: string) => Promise<{ treasuryTotal: number; producersTotal: number; totalCosts: number; balance: number }>;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

// Problemas que uma cópia ruim (ou um banco já inconsistente) mostraria. Na
// origem saudável todos devem ser 0; o importante é serem iguais na origem e
// na cópia.
const INTEGRITY: Record<string, string> = {
  "ciclos fechados sem data de fechamento": `SELECT count(*)::int AS n FROM weeks WHERE status = 'FECHADA' AND "closedAt" IS NULL`,
  "mais de um ciclo aberto": `SELECT GREATEST(count(*) - 1, 0)::int AS n FROM weeks WHERE status = 'ABERTA'`,
  "pedido de escola com preço de outro produto": `SELECT count(*)::int AS n FROM school_orders o JOIN prices p ON p.id = o."priceId" WHERE p."productId" <> o."productId"`,
  "entrega no galpão com preço de outro produto": `SELECT count(*)::int AS n FROM producer_deliveries d JOIN prices p ON p.id = d."priceId" WHERE p."productId" <> d."productId"`,
  "devolução no galpão sem entrega": `SELECT count(*)::int AS n FROM producer_returns r WHERE NOT EXISTS (SELECT 1 FROM producer_deliveries d WHERE d."weekId" = r."weekId" AND d."producerId" = r."producerId" AND d."productId" = r."productId")`,
  "devolução no galpão maior que a entrega": `SELECT count(*)::int AS n FROM producer_returns r JOIN producer_deliveries d ON d."weekId" = r."weekId" AND d."producerId" = r."producerId" AND d."productId" = r."productId" WHERE r."returnedQty" > d."deliveredQty"`,
  "devolução da escola maior que o pedido": `SELECT count(*)::int AS n FROM school_returns r JOIN school_orders o ON o."weekId" = r."weekId" AND o."schoolId" = r."schoolId" AND o."productId" = r."productId" WHERE r."returnedQty" > o."orderedQty"`,
};

export async function buildFingerprint(db: Db, summarize: Summarize, now = new Date()): Promise<Fingerprint> {
  const tableRows = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const tables: Fingerprint["tables"] = {};
  for (const { table_name } of tableRows) {
    // Hash do conteúdo independente da ordem física das linhas.
    const [r] = await db.$queryRawUnsafe<{ n: number; h: string }[]>(
      `SELECT count(*)::int AS n, md5(coalesce(string_agg(x.m, '' ORDER BY x.m), '')) AS h FROM (SELECT md5(t::text) AS m FROM ${quoteIdent(table_name)} t) x`,
    );
    tables[table_name] = { rows: r.n, hash: r.h };
  }

  const migrations = tables._prisma_migrations
    ? (await db.$queryRawUnsafe<{ migration_name: string }[]>(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`)).map((m) => m.migration_name)
    : [];

  const integrity: Fingerprint["integrity"] = {};
  for (const [label, sql] of Object.entries(INTEGRITY)) {
    const [r] = await db.$queryRawUnsafe<{ n: number }[]>(sql);
    integrity[label] = r.n;
  }

  const weeks: WeekTotals[] = [];
  for (const w of await db.week.findMany({ orderBy: { number: "asc" } })) {
    const s = await summarize(w.id);
    weeks.push({
      number: w.number,
      status: w.status,
      startDate: w.startDate.toISOString().slice(0, 10),
      treasuryTotal: s.treasuryTotal,
      producersTotal: s.producersTotal,
      totalCosts: s.totalCosts,
      balance: s.balance,
    });
  }

  return { version: 1, generatedAt: now.toISOString(), migrations, tables, integrity, weeks };
}

export interface FingerprintDiff {
  ok: boolean;
  differences: string[];
}

export function compareFingerprints(source: Fingerprint, restored: Fingerprint): FingerprintDiff {
  const differences: string[] = [];
  const mig = (xs: string[]) => xs.join(",");
  if (mig(source.migrations) !== mig(restored.migrations)) differences.push("Histórico de migrações diferente.");
  for (const name of new Set([...Object.keys(source.tables), ...Object.keys(restored.tables)])) {
    const a = source.tables[name];
    const b = restored.tables[name];
    if (!a) differences.push(`Tabela ${name}: existe só na cópia.`);
    else if (!b) differences.push(`Tabela ${name}: faltando na cópia.`);
    else if (a.rows !== b.rows) differences.push(`Tabela ${name}: ${a.rows} linhas na origem × ${b.rows} na cópia.`);
    else if (a.hash !== b.hash) differences.push(`Tabela ${name}: mesmo número de linhas (${a.rows}), conteúdo diferente.`);
  }
  for (const label of new Set([...Object.keys(source.integrity), ...Object.keys(restored.integrity)])) {
    if (source.integrity[label] !== restored.integrity[label]) differences.push(`Integridade "${label}": origem ${source.integrity[label]} × cópia ${restored.integrity[label]}.`);
  }
  const key = (w: WeekTotals) => `${w.number}`;
  const restoredWeeks = new Map(restored.weeks.map((w) => [key(w), w]));
  for (const w of source.weeks) {
    const r = restoredWeeks.get(key(w));
    if (!r) {
      differences.push(`Ciclo ${w.number}: faltando na cópia.`);
      continue;
    }
    for (const f of ["status", "startDate", "treasuryTotal", "producersTotal", "totalCosts", "balance"] as const) {
      if (w[f] !== r[f]) differences.push(`Ciclo ${w.number}: ${f} origem ${w[f]} × cópia ${r[f]}.`);
    }
  }
  if (restored.weeks.length > source.weeks.length) differences.push(`A cópia tem ${restored.weeks.length - source.weeks.length} ciclo(s) a mais.`);
  return { ok: differences.length === 0, differences };
}
