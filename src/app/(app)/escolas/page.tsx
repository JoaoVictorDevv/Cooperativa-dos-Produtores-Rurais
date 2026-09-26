import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { isOfferedForNewEntries } from "@/lib/productPolicy";
import { EscolasTable } from "./EscolasTable";
import { ImportSchoolOrders } from "./ImportSchoolOrders";

// CA-HIST-*: aceita ?week=<id> pra consultar (so leitura, sem reabrir) o
// pedido de uma semana ja fechada — sem o parametro, mostra a semana
// aberta atual, igual sempre foi.
export default async function EscolasPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekIdParam } = await searchParams;
  const week = weekIdParam ? await prisma.week.findUnique({ where: { id: weekIdParam } }) : await getOpenWeek();

  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">SEM SEMANA ABERTA</div>
            <div className="page-title display">Pedido das Escolas</div>
          </div>
        </div>
        <p>
          Não há nenhuma semana aberta. <Link className="link-action" href="/semanas">Crie uma semana</Link> antes de lançar pedidos.
        </p>
      </>
    );
  }

  const orders = await prisma.schoolOrder.findMany({ where: { weekId: week.id } });
  // Cadastros inativos (ou produtos retirados, como Ovos) continuam visíveis
  // quando têm lançamento neste ciclo — o histórico nunca some da tela.
  const usedSchoolIds = [...new Set(orders.map((o) => o.schoolId))];
  const usedProductIds = [...new Set(orders.filter((o) => Number(o.orderedQty) !== 0).map((o) => o.productId))];
  const [schools, allProducts] = await Promise.all([
    prisma.school.findMany({ where: { OR: [{ active: true }, { id: { in: usedSchoolIds } }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);
  const products = allProducts.filter((p) => isOfferedForNewEntries(p) || usedProductIds.includes(p.id));

  const orderMap: Record<string, number> = {};
  for (const o of orders) {
    orderMap[`${o.schoolId}:${o.productId}`] = Number(o.orderedQty);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">SEMANA {week.number}</div>
          <div className="page-title display">Pedido das Escolas</div>
        </div>
        <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
      </div>
      <p className="table-foot-note" style={{ textAlign: "left", marginTop: -8 }}>
        <Link className="link-action" href={`/semanas/${week.id}`}>
          Ver semana completa (documentos, diferença, balanço) →
        </Link>
      </p>

      {week.status === "ABERTA" && <ImportSchoolOrders weekId={week.id} />}

      <EscolasTable
        key={week.id}
        weekId={week.id}
        schools={schools.map((s) => ({ id: s.id, code: s.code, name: s.name, neighborhood: s.neighborhood }))}
        products={products.map((p) => ({ id: p.id, name: p.name, offered: isOfferedForNewEntries(p) }))}
        orders={orderMap}
        editable={week.status === "ABERTA"}
      />
    </>
  );
}
