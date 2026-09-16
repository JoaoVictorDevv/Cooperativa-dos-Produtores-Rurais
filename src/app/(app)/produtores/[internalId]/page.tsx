import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getProducerPnaeUsage } from "@/lib/pnae";
import { producerPayment } from "@/lib/calc";
import { PrintButton } from "@/components/PrintButton";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ProducerDetailPage({ params }: { params: Promise<{ internalId: string }> }) {
  const { internalId } = await params;
  const producer = await prisma.producer.findUnique({ where: { internalId } });
  if (!producer) notFound();

  const week = await getOpenWeek();
  const pnae = await getProducerPnaeUsage(prisma, producer.id);

  let lines: {
    productName: string;
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
      const payment = delivery
        ? producerPayment(Number(delivery.deliveredQty), returnedQty, Number(delivery.price.price), Number(delivery.logisticsDeductionSnapshot))
        : 0;
      return {
        productName,
        orderedQty: order ? Number(order.orderedQty) : 0,
        deliveredQty: delivery ? Number(delivery.deliveredQty) : null,
        returnedQty,
        payment,
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  }

  return (
    <>
      <Link className="back-link" href="/produtores">
        ← Voltar para Produtores
      </Link>

      <div className="card" style={{ padding: 18, marginBottom: 22 }}>
        <div className="panel-title" style={{ padding: 0, marginBottom: 8 }}>
          Limite anual PNAE (ciclo out–set)
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
          <span>
            Acumulado: <strong>{fmtMoney(pnae.accumulated)}</strong> de {fmtMoney(pnae.limit)}
          </span>
          <span className={`badge ${pnae.alertLevel === "OK" ? "ok" : pnae.alertLevel === "ATENCAO" ? "atencao" : "estourado"}`}>
            {pnae.alertLevel} · {pnae.percentUsed.toFixed(0)}%
          </span>
        </div>
        <div className="pnae-bar-track">
          <div
            className={`pnae-bar-fill ${pnae.alertLevel === "ATENCAO" ? "atencao" : pnae.alertLevel === "ESTOURADO" ? "estourado" : ""}`}
            style={{ width: `${Math.min(pnae.percentUsed, 100)}%` }}
          />
        </div>
        <div className="stat-sub">Restante até o limite: {fmtMoney(pnae.remaining)}</div>
      </div>

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
                <td>{l.orderedQty.toFixed(2)}</td>
                <td className={l.deliveredQty === null ? "mono" : undefined} style={l.deliveredQty === null ? { color: "#8B3A2E" } : undefined}>
                  {l.deliveredQty === null ? "—" : l.deliveredQty.toFixed(2)}
                </td>
                <td>{l.returnedQty.toFixed(2)}</td>
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
        </table>

        <div className="rm-sign">
          <div className="line">Assinatura do produtor</div>
          <div className="line">Data</div>
        </div>
      </div>
    </>
  );
}
