import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkDisposableMarker, checkDisposableTarget, markerFor } from "../testing/disposableDb";
import { resetDisposableDb } from "../testing/integrationDb";

// Ensaio de backup e restauração (etapa 6) inteiro em bancos DESCARTÁVEIS:
// origem = banco criado pelo executor de testes; cópia = outro banco criado
// aqui, com o mesmo tipo de nome e a mesma marca desta execução, apagado no
// fim. pg_dump → pg_restore num banco NOVO → verificação só leitura
// (scripts/backup-verify.ts). Nenhum banco real é tocado.
const target = checkDisposableTarget(process.env);
const token = process.env.COLHEITA_TEST_DB_TOKEN!;
const prisma = new PrismaClient();
const copyName = `${target.database}_r`;
const dir = mkdtempSync(join(tmpdir(), "colheita-backup-"));

function urlFor(database: string, keepQuery = true): string {
  const u = new URL(process.env.DATABASE_URL!);
  u.pathname = `/${database}`;
  if (!keepQuery) u.search = "";
  return u.toString();
}

async function assertMarked(client: PrismaClient, database: string) {
  const [row] = await client.$queryRaw<{ current_database: string; comment: string | null }[]>`
    SELECT current_database() AS current_database, shobj_description(d.oid, 'pg_database') AS comment
    FROM pg_database d WHERE d.datname = current_database()`;
  checkDisposableMarker({ host: target.host, database }, { currentDatabase: row.current_database, comment: row.comment }, token);
}

function verify(database: string, mode: "salvar" | "comparar") {
  return spawnSync("npx", ["tsx", "scripts/backup-verify.ts", `--${mode}`, join(dir, "origem.json")], {
    env: { ...process.env, VERIFY_DATABASE_URL: urlFor(database) },
    encoding: "utf8",
  });
}

beforeAll(async () => {
  await assertMarked(prisma, target.database);
  await resetDisposableDb(prisma, target, token);
  // Dados fictícios: um ciclo fechado com galpão/escolas/custos e um aberto.
  const product = await prisma.product.create({ data: { slug: "drill-alface", name: "Alface (ensaio)" } });
  const price = await prisma.price.create({ data: { productId: product.id, price: 14.62, validFrom: new Date("2020-01-01") } });
  const school = await prisma.school.create({ data: { code: "D001", name: "Escola Ensaio" } });
  const producer = await prisma.producer.create({ data: { internalId: "D1", name: "Produtor Ensaio" } });
  const reason = await prisma.returnReason.create({ data: { code: 951, description: "Ensaio" } });
  const closed = await prisma.week.create({ data: { referenceDate: new Date("2026-07-05"), startDate: new Date("2026-07-05"), endDate: new Date("2026-07-08") } });
  await prisma.schoolOrder.create({ data: { weekId: closed.id, schoolId: school.id, productId: product.id, orderedQty: 100, priceId: price.id } });
  await prisma.schoolReturn.create({ data: { weekId: closed.id, schoolId: school.id, productId: product.id, returnedQty: 5, returnReasonId: reason.id } });
  await prisma.producerDelivery.create({ data: { weekId: closed.id, producerId: producer.id, productId: product.id, deliveredQty: 100, deliveredAt: new Date("2026-07-06T08:00:00Z"), priceId: price.id, logisticsDeductionSnapshot: 3.67 } });
  await prisma.producerReturn.create({ data: { weekId: closed.id, producerId: producer.id, productId: product.id, returnedQty: 4, returnReasonId: reason.id } });
  await prisma.weeklyCost.create({ data: { weekId: closed.id, category: "TRANSPORTE", amount: 250 } });
  await prisma.week.update({ where: { id: closed.id }, data: { status: "FECHADA", closedAt: new Date("2026-07-09T12:00:00Z") } });
  const open = await prisma.week.create({ data: { referenceDate: new Date("2026-07-12"), startDate: new Date("2026-07-12"), endDate: new Date("2026-07-15") } });
  await prisma.schoolOrder.create({ data: { weekId: open.id, schoolId: school.id, productId: product.id, orderedQty: 42.5, priceId: price.id } });
  const user = await prisma.user.create({ data: { name: "Ensaio", email: "ensaio@example.invalid", passwordHash: "x", role: "ADMIN" } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "ENSAIO", entityType: "Week", entityId: closed.id, reason: "ensaio de backup" } });
});

afterAll(async () => {
  // Só apaga a cópia se ela tiver o nome e a marca desta execução.
  const exists = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM pg_database WHERE datname = $1`, copyName);
  if (exists[0].n) {
    const copy = new PrismaClient({ datasourceUrl: urlFor(copyName) });
    try {
      await assertMarked(copy, copyName);
    } finally {
      await copy.$disconnect();
    }
    await prisma.$executeRawUnsafe(`DROP DATABASE "${copyName}" WITH (FORCE)`);
  }
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("ensaio de backup e restauração (bancos descartáveis)", () => {
  it("dump → restauração num banco novo → verificação só leitura: cópia idêntica", async () => {
    const saved = verify(target.database, "salvar");
    expect(saved.stderr).toContain("Conexão somente leitura confirmada");
    expect(saved.status).toBe(0);
    expect(saved.stdout).not.toMatch(/Atenção \(integridade\)/);

    const dump = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--file", join(dir, "backup.dump"), `--dbname=${urlFor(target.database, false)}`], { encoding: "utf8" });
    expect(dump.status, dump.stderr).toBe(0);

    expect(copyName).toMatch(/^colheita_descartavel_[a-z0-9_]{6,60}$/);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${copyName}"`);
    await prisma.$executeRawUnsafe(`COMMENT ON DATABASE "${copyName}" IS '${markerFor(token)}'`);
    const restore = spawnSync("pg_restore", ["--no-owner", "--no-privileges", `--dbname=${urlFor(copyName, false)}`, join(dir, "backup.dump")], { encoding: "utf8" });
    expect(restore.status, restore.stderr).toBe(0);

    const compared = verify(copyName, "comparar");
    expect(compared.stdout).toContain("Cópia IDÊNTICA à origem");
    expect(compared.status).toBe(0);
    for (const out of [saved.stdout, saved.stderr, compared.stdout, compared.stderr]) expect(out).not.toContain("postgresql://");
  }, 120_000);

  it("a cópia restaurada mantém a proteção do ciclo fechado (gatilhos do banco)", async () => {
    const copy = new PrismaClient({ datasourceUrl: urlFor(copyName) });
    try {
      await assertMarked(copy, copyName);
      await expect(copy.$executeRawUnsafe(`UPDATE weekly_costs SET amount = amount + 1`)).rejects.toThrow(/fechada/i);
    } finally {
      await copy.$disconnect();
    }
  }, 60_000);

  it("a verificação detecta uma cópia adulterada (pedido do ciclo aberto alterado na cópia)", async () => {
    const copy = new PrismaClient({ datasourceUrl: urlFor(copyName) });
    try {
      await assertMarked(copy, copyName);
      await copy.$executeRawUnsafe(`UPDATE school_orders SET "orderedQty" = "orderedQty" + 1 WHERE "weekId" IN (SELECT id FROM weeks WHERE status = 'ABERTA')`);
    } finally {
      await copy.$disconnect();
    }
    const compared = verify(copyName, "comparar");
    expect(compared.status).toBe(1);
    expect(compared.stdout).toContain("Tabela school_orders: mesmo número de linhas");
    expect(compared.stdout).toMatch(/treasuryTotal origem 621\.35 × cópia 635\.97/);
  }, 60_000);

  it("o script de verificação não consegue gravar (conexão somente leitura)", async () => {
    const run = spawnSync("npx", ["tsx", "-e", `
      process.env.DATABASE_URL = (() => { const u = new URL(process.env.VERIFY_DATABASE_URL); u.searchParams.set("options", "-c default_transaction_read_only=on"); return u.toString(); })();
      const { PrismaClient } = require("@prisma/client");
      const p = new PrismaClient();
      p.$executeRawUnsafe("UPDATE weekly_costs SET amount = 0").then(() => { console.log("GRAVOU"); process.exit(1); }, (e) => { console.log(/read-only/.test(e.message) ? "RECUSADO" : "OUTRO ERRO"); process.exit(0); });
    `], { env: { ...process.env, VERIFY_DATABASE_URL: urlFor(copyName) }, encoding: "utf8" });
    expect(run.stdout).toContain("RECUSADO");
  }, 60_000);
});
