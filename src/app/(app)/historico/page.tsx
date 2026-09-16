import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { WeekStatus } from "@prisma/client";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

// CA-HIST-01/02/09: lista semanas fechadas (e a aberta), filtro por
// status sem alterar nenhum dado — so leitura.
export default async function HistoricoPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filterStatus = status === "ABERTA" || status === "FECHADA" ? (status as WeekStatus) : undefined;

  const weeks = await prisma.week.findMany({
    where: filterStatus ? { status: filterStatus } : undefined,
    orderBy: { number: "desc" },
    include: { closedBy: true },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">CONSULTA</div>
          <div className="page-title display">Histórico de semanas</div>
        </div>
      </div>

      <div className="toolbar">
        <Link className={`filter-chip${!filterStatus ? " active" : ""}`} href="/historico">
          Todas
        </Link>
        <Link className="filter-chip" href="/historico?status=FECHADA">
          Fechadas
        </Link>
        <Link className="filter-chip" href="/historico?status=ABERTA">
          Aberta
        </Link>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Referência</th>
              <th>Período</th>
              <th>Status</th>
              <th>Fechada por</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id}>
                <td className="name-cell">Semana {w.number}</td>
                <td>{fmt(w.referenceDate)}</td>
                <td>
                  {fmt(w.startDate)} – {fmt(w.endDate)}
                </td>
                <td>
                  <span className={`badge ${w.status === "ABERTA" ? "aberta" : "fechada"}`}>{w.status}</span>
                </td>
                <td>{w.closedBy?.name ?? "—"}</td>
                <td style={{ display: "flex", gap: 10 }}>
                  <Link className="link-action" href={`/semanas/${w.id}`}>
                    Ver
                  </Link>
                  <Link className="link-action" href={`/resumo?week=${w.id}`}>
                    Resumo
                  </Link>
                  <Link className="link-action" href={`/balanco?week=${w.id}`}>
                    Balanço
                  </Link>
                </td>
              </tr>
            ))}
            {weeks.length === 0 && (
              <tr>
                <td colSpan={6} className="table-foot-note">
                  Nenhuma semana encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
