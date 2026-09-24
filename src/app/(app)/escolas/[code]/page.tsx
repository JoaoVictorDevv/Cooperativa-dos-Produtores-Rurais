import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { PrintButton } from "@/components/PrintButton";
import { ReturnRow } from "./ReturnRow";
import { DeliveryForm } from "./DeliveryForm";

export default async function SchoolDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const school = await prisma.school.findUnique({ where: { code } });
  if (!school) notFound();

  const week = await getOpenWeek();
  const reasons = await prisma.returnReason.findMany({ where: { active: true }, orderBy: { code: "asc" } });

  let orders: { productId: string; orderedQty: number }[] = [];
  let returnsByProduct = new Map<string, { returnedQty: number; returnReasonId: string }>();
  let delivery: { weekday: string; deliveredAt: Date } | null = null;
  let products: { id: string; name: string; slug: string }[] = [];

  if (week) {
    const [orderRows, returnRows, deliveryRow, productRows] = await Promise.all([
      prisma.schoolOrder.findMany({ where: { weekId: week.id, schoolId: school.id } }),
      prisma.schoolReturn.findMany({ where: { weekId: week.id, schoolId: school.id } }),
      prisma.schoolDelivery.findUnique({ where: { weekId_schoolId: { weekId: week.id, schoolId: school.id } } }),
      prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    orders = orderRows.map((o) => ({ productId: o.productId, orderedQty: Number(o.orderedQty) }));
    returnsByProduct = new Map(
      returnRows.map((r) => [r.productId, { returnedQty: Number(r.returnedQty), returnReasonId: r.returnReasonId }]),
    );
    delivery = deliveryRow ? { weekday: deliveryRow.weekday, deliveredAt: deliveryRow.deliveredAt } : null;
    products = productRows;
  }

  const orderedByProduct = new Map(orders.map((o) => [o.productId, o.orderedQty]));
  const rowsWithOrder = products.filter((p) => (orderedByProduct.get(p.id) ?? 0) > 0);

  return (
    <>
      <Link className="back-link" href="/escolas">
        ← Voltar para Pedido das Escolas
      </Link>

      {week && week.status === "ABERTA" && (
        <div className="rm-actions">
          <PrintButton />
        </div>
      )}
      {!week && <p>Não há semana aberta — exibindo apenas o cadastro da escola.</p>}

      <div className="romaneio-sheet">
        <div className="rm-brand">COOPERATIVA DOS PRODUTORES RURAIS DE PETRÓPOLIS</div>
        <div className="rm-sub">
          Controle de Entrega — Escola{week ? ` · Semana ${week.number}` : ""}
        </div>
        <div className="rm-info">
          <div>
            <span>Escola</span>
            <strong>{school.name}</strong>
          </div>
          <div>
            <span>Código</span>
            <strong>{school.code}</strong>
          </div>
          <div>
            <span>Bairro</span>
            <strong>{school.neighborhood ?? "—"}</strong>
          </div>
          <div>
            <span>Endereço</span>
            <strong>{school.address ?? "—"}</strong>
          </div>
          <div>
            <span>Telefone</span>
            <strong>{school.phone ?? "—"}</strong>
          </div>
        </div>

        {week && (
          <DeliveryForm
            weekId={week.id}
            schoolId={school.id}
            initialWeekday={delivery?.weekday ?? null}
            initialDate={delivery ? delivery.deliveredAt.toISOString().slice(0, 10) : null}
            editable={week.status === "ABERTA"}
          />
        )}

        <div className="rm-table-title">Produtos pedidos nesta semana</div>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style={{ width: 90 }}>Pedido</th>
              <th style={{ width: 110 }}>Devolução</th>
              <th style={{ width: 160 }}>Motivo</th>
              <th style={{ width: 90 }}>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithOrder.map((p) => {
              const existingReturn = returnsByProduct.get(p.id);
              return (
                <ReturnRow
                  key={p.id}
                  weekId={week!.id}
                  schoolId={school.id}
                  productId={p.id}
                  productName={p.name}
                  productSlug={p.slug}
                  orderedQty={orderedByProduct.get(p.id) ?? 0}
                  initialReturnedQty={existingReturn?.returnedQty ?? 0}
                  initialReasonId={existingReturn?.returnReasonId ?? null}
                  reasons={reasons}
                  editable={week!.status === "ABERTA"}
                />
              );
            })}
            {rowsWithOrder.length === 0 && (
              <tr>
                <td colSpan={5} className="table-foot-note">
                  Nenhum pedido lançado para esta escola nesta semana.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rm-sign">
          <div className="line">Assinatura de quem recebeu</div>
          <div className="line">Data</div>
        </div>
      </div>
    </>
  );
}
