import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek, getSettings } from "@/lib/week";
import { producerPayment } from "@/lib/calc";
import { ProdutoresTable } from "./ProdutoresTable";

export default async function ProdutoresPage() {
  const week = await getOpenWeek();

  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">SEM SEMANA ABERTA</div>
            <div className="page-title display">Produtores</div>
          </div>
        </div>
        <p>
          Não há nenhuma semana aberta. <Link className="link-action" href="/semanas">Crie uma semana</Link> antes de lançar dados.
        </p>
      </>
    );
  }

  const [producers, products, mapEntries, allocations, orders, deliveries, returns, settings, reasons] =
    await Promise.all([
      prisma.producer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: { prices: { where: { validTo: null } } },
      }),
      prisma.productionMapEntry.findMany(),
      prisma.producerAllocation.findMany({ where: { weekId: week.id } }),
      prisma.producerOrder.findMany({ where: { weekId: week.id } }),
      prisma.producerDelivery.findMany({ where: { weekId: week.id }, include: { price: true } }),
      prisma.producerReturn.findMany({ where: { weekId: week.id } }),
      getSettings(),
      prisma.returnReason.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    ]);

  const defaultDeduction = Number(settings.logisticsDeductionPerKg);
  const productById = new Map(
    products.map((p) => [p.id, { id: p.id, name: p.name, slug: p.slug, price: Number(p.prices[0]?.price ?? 0) }]),
  );

  const planByProducer = new Map<string, Set<string>>();
  for (const entry of mapEntries) {
    const set = planByProducer.get(entry.producerId) ?? new Set<string>();
    set.add(entry.productId);
    planByProducer.set(entry.producerId, set);
  }

  const allocByKey = new Map(allocations.map((a) => [`${a.producerId}:${a.productId}`, Number(a.allocatedQty)]));
  const orderByKey = new Map(orders.map((o) => [`${o.producerId}:${o.productId}`, Number(o.orderedQty)]));
  const deliveryByKey = new Map(
    deliveries.map((d) => [
      `${d.producerId}:${d.productId}`,
      {
        deliveredQty: Number(d.deliveredQty),
        deliveredAt: d.deliveredAt.toISOString().slice(0, 10),
        price: Number(d.price.price),
        logisticsDeductionPerKg: Number(d.logisticsDeductionSnapshot),
      },
    ]),
  );
  const returnByKey = new Map(
    returns.map((r) => [`${r.producerId}:${r.productId}`, { returnedQty: Number(r.returnedQty), returnReasonId: r.returnReasonId }]),
  );

  const rows = producers.map((producer) => {
    const relevantIds = new Set<string>(planByProducer.get(producer.id) ?? []);
    for (const key of [...allocByKey.keys(), ...orderByKey.keys(), ...deliveryByKey.keys(), ...returnByKey.keys()]) {
      const [pid, prodId] = key.split(":");
      if (pid === producer.id) relevantIds.add(prodId);
    }

    const lines = [...relevantIds]
      .map((productId) => {
        const product = productById.get(productId);
        if (!product) return null;
        const key = `${producer.id}:${productId}`;
        const delivery = deliveryByKey.get(key);
        const ret = returnByKey.get(key);
        return {
          productId,
          productName: product.name,
          productSlug: product.slug,
          allocatedQty: allocByKey.get(key) ?? 0,
          orderedQty: orderByKey.get(key) ?? 0,
          deliveredQty: delivery?.deliveredQty ?? null,
          deliveredAt: delivery?.deliveredAt ?? null,
          returnedQty: ret?.returnedQty ?? 0,
          returnReasonId: ret?.returnReasonId ?? null,
          price: delivery?.price ?? product.price,
          logisticsDeductionPerKg: delivery?.logisticsDeductionPerKg ?? defaultDeduction,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    const totalOrdered = lines.reduce((s, l) => s + l.orderedQty, 0);
    const totalDelivered = lines.reduce((s, l) => s + (l.deliveredQty ?? 0), 0);
    const pending = lines.some((l) => l.orderedQty > 0 && l.deliveredQty === null);
    const totalPayment = lines.reduce(
      (s, l) => s + producerPayment(l.deliveredQty ?? 0, l.returnedQty, l.price, l.logisticsDeductionPerKg),
      0,
    );

    return {
      weekId: week.id,
      producerId: producer.id,
      producerName: producer.name,
      producerInternalId: producer.internalId,
      editable: week.status === "ABERTA",
      reasons,
      initialLines: lines,
      allProducts: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.prices[0]?.price ?? 0),
        logisticsDeductionPerKg: defaultDeduction,
      })),
      pending,
      totalOrdered,
      totalDelivered,
      totalPayment: Math.round(totalPayment * 100) / 100,
    };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">SEMANA {week.number}</div>
          <div className="page-title display">Divisão, Pedido &amp; Entrega dos Produtores</div>
        </div>
        <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
      </div>

      <ProdutoresTable rows={rows} />
    </>
  );
}
