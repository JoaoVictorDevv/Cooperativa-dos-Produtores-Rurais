import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { checkDisposableTarget } from "./testing/disposableDb";
import { resetDisposableDb } from "./testing/integrationDb";

// Carga leve e condições de corrida com as AÇÕES DE SERVIDOR reais (transação,
// validação, auditoria) em banco descartável. Só a sessão é trocada por um
// usuário de teste; revalidação de cache é ignorada.
const testUser = { id: "", name: "Carga", email: "carga@example.invalid", role: "OPERADOR" as const };
vi.mock("@/lib/dal", () => ({
  verifySession: async () => testUser,
  requireOperator: async () => testUser,
  requireRole: async () => testUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("REDIRECT"), { to });
  },
}));

const { saveSchoolOrder } = await import("@/app/actions/schoolOrders");
const { saveSchoolReturn } = await import("@/app/actions/schoolReturns");
const { saveProducerDelivery } = await import("@/app/actions/producerDeliveries");
const { saveProducerReturn } = await import("@/app/actions/producerReturns");
const { closeWeek, createWeek } = await import("@/app/actions/weeks");
const { saveSchoolDelivery } = await import("@/app/actions/schoolDeliveries");
const { saveProducerAllocation } = await import("@/app/actions/producerAllocations");
const { previewOrdersFromAllocation, confirmOrdersFromAllocation } = await import("@/app/actions/producerOrdersFromAllocation");
const { planOrdersFromAllocation, allocationPlanSignature } = await import("./producerOrdersFromAllocation");
const { getWeekFinancialSummary } = await import("./weekSummary");

const target = checkDisposableTarget(process.env);
const prisma = new PrismaClient();
const ids = { week: "", reason: "", products: [] as string[], schools: [] as string[], producer: "" };
const ROUNDS = 40;

beforeAll(async () => {
  await resetDisposableDb(prisma, target, process.env.COLHEITA_TEST_DB_TOKEN!);
  testUser.id = (await prisma.user.create({ data: { name: testUser.name, email: testUser.email, passwordHash: "x", role: "OPERADOR" } })).id;
  await prisma.settings.create({ data: {} }).catch(() => {});
  ids.reason = (await prisma.returnReason.create({ data: { code: 971, description: "Carga" } })).id;
  for (let i = 0; i < 10; i++) {
    const p = await prisma.product.create({ data: { slug: `carga-${i}`, name: `Produto carga ${i}` } });
    await prisma.price.create({ data: { productId: p.id, price: 5 + i * 1.11, validFrom: new Date("2020-01-01") } });
    ids.products.push(p.id);
  }
  await prisma.school.createMany({ data: Array.from({ length: 191 }, (_, i) => ({ code: `C${1000 + i}`, name: `Escola Carga ${i}` })) });
  ids.schools = (await prisma.school.findMany({ orderBy: { code: "asc" } })).map((s) => s.id);
  ids.producer = (await prisma.producer.create({ data: { internalId: "CP1", name: "Produtor Carga" } })).id;
  ids.week = (await prisma.week.create({ data: { referenceDate: new Date("2026-10-05"), startDate: new Date("2026-10-04"), endDate: new Date("2026-10-08") } })).id;
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<unknown>) {
  const out: unknown[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

describe("carga leve e corridas (ações reais, banco descartável)", () => {
  it("191 escolas × 10 produtos em paralelo: nenhuma linha perdida ou duplicada, auditoria completa, total certo", async () => {
    const jobs = ids.schools.flatMap((s, si) => ids.products.map((p, pi) => ({ s, p, qty: ((si * 7 + pi * 3) % 50) + 0.25 })));
    const results = (await inBatches(jobs, 25, (j) => saveSchoolOrder(ids.week, j.s, j.p, j.qty))) as { ok: boolean; error?: string }[];
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(await prisma.schoolOrder.count({ where: { weekId: ids.week } })).toBe(1910);
    expect(await prisma.auditLog.count({ where: { action: "SCHOOL_ORDER_CREATE" } })).toBe(1910);
    const sum = await prisma.schoolOrder.aggregate({ where: { weekId: ids.week }, _sum: { orderedQty: true } });
    expect(Number(sum._sum.orderedQty)).toBeCloseTo(jobs.reduce((a, j) => a + j.qty, 0), 2);
    const summary = await getWeekFinancialSummary(ids.week);
    expect(summary.treasuryLines).toHaveLength(1910);
  }, 180_000);

  it("mesma escola/produto gravada 10 vezes ao mesmo tempo: uma linha só, estado final = um dos valores, auditoria bate", async () => {
    const [s, p] = [ids.schools[0], ids.products[0]];
    const before = await prisma.auditLog.count();
    const values = Array.from({ length: 10 }, (_, i) => 60 + i);
    const results = await Promise.all(values.map((v) => saveSchoolOrder(ids.week, s, p, v)));
    const rows = await prisma.schoolOrder.findMany({ where: { weekId: ids.week, schoolId: s, productId: p } });
    expect(rows).toHaveLength(1);
    expect(values).toContain(Number(rows[0].orderedQty));
    const oks = results.filter((r) => r.ok).length;
    expect(await prisma.auditLog.count()).toBe(before + oks);
    for (const r of results.filter((x) => !x.ok)) expect(r.error).not.toMatch(/school_orders|Unique constraint|prisma/i);
  }, 60_000);

  it(`corrida pedido × devolução da escola (${ROUNDS} rodadas): a devolução nunca fica maior que o pedido`, async () => {
    const [s, p] = [ids.schools[1], ids.products[1]];
    const violations: string[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await prisma.schoolReturn.deleteMany({ where: { weekId: ids.week, schoolId: s, productId: p } });
      await saveSchoolOrder(ids.week, s, p, 20);
      await Promise.all([saveSchoolOrder(ids.week, s, p, 5), saveSchoolReturn(ids.week, s, p, 10, ids.reason)]);
      const order = await prisma.schoolOrder.findUniqueOrThrow({ where: { weekId_schoolId_productId: { weekId: ids.week, schoolId: s, productId: p } } });
      const ret = await prisma.schoolReturn.findUnique({ where: { weekId_schoolId_productId: { weekId: ids.week, schoolId: s, productId: p } } });
      if (ret && Number(ret.returnedQty) > Number(order.orderedQty)) violations.push(`rodada ${i}: pedido ${order.orderedQty}, devolução ${ret.returnedQty}`);
    }
    expect(violations).toEqual([]);
  }, 120_000);

  it(`corrida entrega × devolução no galpão (${ROUNDS} rodadas): a devolução nunca fica maior que a entrega`, async () => {
    const p = ids.products[2];
    const when = "2026-10-05T08:00";
    const violations: string[] = [];
    for (let i = 0; i < ROUNDS; i++) {
      await prisma.producerReturn.deleteMany({ where: { weekId: ids.week, producerId: ids.producer, productId: p } });
      const first = await saveProducerDelivery(ids.week, ids.producer, p, 20, when);
      if (!first.ok) throw new Error(first.error);
      await Promise.all([saveProducerDelivery(ids.week, ids.producer, p, 5, when), saveProducerReturn(ids.week, ids.producer, p, 10, ids.reason)]);
      const d = await prisma.producerDelivery.findUniqueOrThrow({ where: { weekId_producerId_productId: { weekId: ids.week, producerId: ids.producer, productId: p } } });
      const r = await prisma.producerReturn.findUnique({ where: { weekId_producerId_productId: { weekId: ids.week, producerId: ids.producer, productId: p } } });
      if (r && Number(r.returnedQty) > Number(d.deliveredQty)) violations.push(`rodada ${i}: entrega ${d.deliveredQty}, devolução ${r.returnedQty}`);
    }
    expect(violations).toEqual([]);
  }, 120_000);

  it("fechar a semana no meio de 100 gravações: cada linha fica com o valor de quem conseguiu gravar; nada depois do fechamento", async () => {
    // Ciclo fechável: toda escola com pedido tem o dia de entrega registrado.
    const delivered = (await inBatches(ids.schools, 25, (sid) => saveSchoolDelivery(ids.week, sid, "SEGUNDA", "2026-10-05"))) as { ok: boolean; error?: string }[];
    expect(delivered.filter((d) => !d.ok)).toEqual([]);
    // Linhas já existem (teste de carga); cada gravação usa um valor único.
    const jobs = ids.schools.slice(0, 50).flatMap((s) => [ids.products[3], ids.products[4]].map((p) => ({ s, p })));
    const before = new Map((await prisma.schoolOrder.findMany({ where: { weekId: ids.week } })).map((r) => [`${r.schoolId}:${r.productId}`, Number(r.orderedQty)]));
    const values = jobs.map((_, i) => 1000 + i);
    const saves = jobs.map((j, i) => saveSchoolOrder(ids.week, j.s, j.p, values[i]));
    const [results, closed] = await Promise.all([Promise.all(saves), closeWeek(ids.week)]);
    const after = new Map((await prisma.schoolOrder.findMany({ where: { weekId: ids.week } })).map((r) => [`${r.schoolId}:${r.productId}`, Number(r.orderedQty)]));
    const wrong: string[] = [];
    jobs.forEach((j, i) => {
      const k = `${j.s}:${j.p}`;
      const expected = results[i].ok ? values[i] : before.get(k);
      if (after.get(k) !== expected) wrong.push(`${k}: ok=${results[i].ok} valor=${after.get(k)} esperado=${expected}`);
      if (!results[i].ok) expect(results[i].error).toMatch(/fechada/i);
    });
    expect(wrong).toEqual([]);
    expect(closed.ok).toBe(true);
    const week = await prisma.week.findUniqueOrThrow({ where: { id: ids.week } });
    expect(week.status).toBe("FECHADA");
    // Toda alteração bem-sucedida tem auditoria, e nenhuma é posterior ao fechamento.
    const audits = await prisma.auditLog.findMany({ where: { action: { startsWith: "SCHOOL_ORDER_" }, createdAt: { gt: week.closedAt! } } });
    expect(audits).toEqual([]);
    const late = await saveSchoolOrder(ids.week, ids.schools[60], ids.products[3], 1);
    expect(late).toEqual({ ok: false, error: "Esta semana esta fechada. Um ADMIN precisa reabri-la para editar." });
  }, 120_000);

  it("duas pessoas criando semana ao mesmo tempo: só uma semana aberta", async () => {
    await prisma.week.updateMany({ where: { status: "ABERTA" }, data: { status: "FECHADA", closedAt: new Date() } });
    const form = () => {
      const f = new FormData();
      f.set("referenceDate", "2026-10-12");
      f.set("startDate", "2026-10-11");
      f.set("endDate", "2026-10-15");
      return f;
    };
    const outcomes = await Promise.allSettled([createWeek({}, form()), createWeek({}, form()), createWeek({}, form())]);
    const created = outcomes.filter((o) => o.status === "rejected" && (o.reason as Error).message === "REDIRECT").length;
    expect(created).toBe(1);
    expect(await prisma.week.count({ where: { status: "ABERTA" } })).toBe(1);
    for (const o of outcomes) if (o.status === "fulfilled") expect(o.value.error).toMatch(/aberta/i);
  }, 60_000);

  it("duas confirmações simultâneas da divisão → pedido: nenhum pedido duplicado, auditoria de uma só vez", async () => {
    const week = await prisma.week.findFirstOrThrow({ where: { status: "ABERTA" } });
    const producers = [];
    for (let i = 0; i < 20; i++) producers.push(await prisma.producer.create({ data: { internalId: `CD${i}`, name: `Produtor Divisão ${i}` } }));
    const allocations = (await Promise.all(producers.map((p, i) => saveProducerAllocation(week.id, ids.products[5], p.id, 10 + i)))) as { ok: boolean; error?: string }[];
    expect(allocations.filter((a) => !a.ok)).toEqual([]);
    const preview = await previewOrdersFromAllocation(week.id);
    if (!preview.ok || !preview.input) throw new Error(preview.error);
    const decisions = { replaceWithAllocation: {} };
    const signature = allocationPlanSignature(planOrdersFromAllocation(preview.input, decisions));
    const results = await Promise.all([confirmOrdersFromAllocation(week.id, decisions, signature), confirmOrdersFromAllocation(week.id, decisions, signature)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok)!;
    expect(failed.error).not.toMatch(/producer_orders|Unique constraint|prisma/i);
    expect(await prisma.producerOrder.count({ where: { weekId: week.id } })).toBe(20);
    expect(await prisma.auditLog.count({ where: { action: "PRODUCER_ORDER_FROM_ALLOCATION_CREATE" } })).toBe(20);
  }, 60_000);
});
