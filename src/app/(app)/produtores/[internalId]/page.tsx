import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { producerPayment } from "@/lib/calc";
import { formatQty, formatQtyNumber } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Aceita ?week=<id> pra abrir a ficha de uma semana especifica (aberta ou
// ja fechada) — sem o parametro, cai na semana aberta atual.
export default async function ProducerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ internalId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { internalId } = await params;
  const { week: weekIdParam } = await searchParams;
  const producer = await prisma.producer.findUnique({ where: { internalId } });
  if (!producer) notFound();

  const week = weekIdParam ? await prisma.week.findUnique({ where: { id: weekIdParam } }) : await getOpenWeek();

  let lines: {
    productName: string;
    productSlug: string;
    orderedQty: number;
    deliveredQty: number | null;
    returnedQty: number;
    payment: number;
  }[] = [];

  if (week) {
    const [orders, deliveries, returns] = await Promise.all([
      prisma.producerOrder.findMany({ where: { weekId: week.id, producerId: producer.id }, include: { product: true } }),
      prisma.producerDelivery.findMany({
        where: { weekId: week.id, producerId: producer.id },
        include: { product: true, price: true },
      }),
      prisma.producerReturn.findMany({ where: { weekId: week.id, producerId: producer.id } }),
    ]);
    const returnByProduct = new Map(returns.map((r) => [r.productId, Number(r.returnedQty)]));
    const deliveryByProduct = new Map(deliveries.map((d) => [d.productId, d]));

    const productIds = new Set([...orders.map((o) => o.productId), ...deliveries.map((d) => d.productId)]);
    lines = [...productIds].map((productId) => {
      const order = orders.find((o) => o.productId === productId);
      const delivery = deliveryByProduct.get(productId);
      const returnedQty = returnByProduct.get(productId) ?? 0;
      const productName = order?.product.name ?? delivery?.product.name ?? "—";
      const productSlug = order?.product.slug ?? delivery?.product.slug ?? "";
      const payment = delivery
        ? producerPayment(Number(delivery.deliveredQty), returnedQty, Number(delivery.price.price), Number(delivery.logisticsDeductionSnapshot))
        : 0;
      return {
        productName,
        productSlug,
        orderedQty: order ? Number(order.orderedQty) : 0,
        deliveredQty: delivery ? Number(delivery.deliveredQty) : null,
        returnedQty,
        payment,
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  }

  const totals = lines.reduce(
    (acc, l) => ({
      ordered: acc.ordered + l.orderedQty,
      delivered: acc.delivered + (l.deliveredQty ?? 0),
      returned: acc.returned + l.returnedQty,
      payment: acc.payment + l.payment,
    }),
    { ordered: 0, delivered: 0, returned: 0, payment: 0 },
  );

  return (
    <>
      <Link className="back-link" href={week ? `/produtores?week=${week.id}` : "/produtores"}>
        ← Voltar para Produtores
      </Link>

      {week && (
        <div className="rm-actions">
          <PrintButton />
        </div>
      )}

      <div className="romaneio-sheet">
        <div className="rm-brand">COOPERATIVA DOS PRODUTORES RURAIS DE PETRÓPOLIS</div>
        <div className="rm-sub">Controle de Entrega — Produtor{week ? ` · Semana ${week.number}` : ""}</div>
        <div className="rm-info">
          <div>
            <span>Produtor</span>
            <strong>{producer.name}</strong>
          </div>
          <div>
            <span>Código interno</span>
            <strong>{producer.internalId}</strong>
          </div>
          <div>
            <span>Telefone</span>
            <strong>{producer.phone ?? "—"}</strong>
          </div>
        </div>

        <div className="rm-table-title">Produtos</div>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style={{ width: 90 }}>Pedido</th>
              <th style={{ width: 90 }}>Entrega</th>
              <th style={{ width: 90 }}>Devolução</th>
              <th style={{ width: 100 }}>Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.productName}>
                <td>{l.productName}</td>
                <td>{formatQty(l.orderedQty, l.productSlug)}</td>
                <td className={l.deliveredQty === null ? "mono" : undefined} style={l.deliveredQty === null ? { color: "#8B3A2E" } : undefined}>
                  {l.deliveredQty === null ? "—" : formatQty(l.deliveredQty, l.productSlug)}
                </td>
                <td>{formatQty(l.returnedQty, l.productSlug)}</td>
                <td>{fmtMoney(l.payment)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="table-foot-note">
                  Nenhum lançamento nesta semana.
                </td>
              </tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--ink)", fontWeight: 600 }}>
                <td>Total</td>
                <td>{formatQtyNumber(totals.ordered)}</td>
                <td>{formatQtyNumber(totals.delivered)}</td>
                <td>{formatQtyNumber(totals.returned)}</td>
                <td>{fmtMoney(totals.payment)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="rm-sign">
          <div className="line">Assinatura do produtor</div>
          <div className="line">Data</div>
        </div>
      </div>
    </>
  );
}
