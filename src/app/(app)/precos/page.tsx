import { prisma } from "@/lib/prisma";
import { ScheduleForm } from "./ScheduleForm";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function PrecosPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { prices: { orderBy: { validFrom: "desc" }, take: 5 } },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">CADASTRO</div>
          <div className="page-title display">Preços por produto</div>
        </div>
      </div>

      <ScheduleForm products={products.map((p) => ({ id: p.id, name: p.name }))} />

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço vigente</th>
              <th>Vigente desde</th>
              <th>Histórico recente</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const current = p.prices.find((pr) => pr.validTo === null);
              return (
                <tr key={p.id}>
                  <td className="name-cell">{p.name}</td>
                  <td className="mono">{current ? fmtMoney(Number(current.price)) : "—"}</td>
                  <td>{current ? fmt(current.validFrom) : "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {p.prices
                      .filter((pr) => pr.validTo !== null)
                      .map((pr) => `${fmtMoney(Number(pr.price))} (até ${fmt(pr.validTo!)})`)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
