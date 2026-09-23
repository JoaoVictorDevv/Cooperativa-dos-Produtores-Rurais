import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { EscolasTable } from "./EscolasTable";

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

  const [schools, products, orders] = await Promise.all([
    prisma.school.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.schoolOrder.findMany({ where: { weekId: week.id } }),
  ]);

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

      <EscolasTable
        weekId={week.id}
        schools={schools.map((s) => ({ id: s.id, code: s.code, name: s.name, neighborhood: s.neighborhood }))}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        orders={orderMap}
        editable={week.status === "ABERTA"}
      />
    </>
  );
}
