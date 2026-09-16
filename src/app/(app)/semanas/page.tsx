import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { NewWeekForm } from "./NewWeekForm";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default async function SemanasPage() {
  const [openWeek, weeks] = await Promise.all([
    getOpenWeek(),
    prisma.week.findMany({ orderBy: { number: "desc" }, take: 60 }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">CICLO OPERACIONAL</div>
          <div className="page-title display">Semanas</div>
        </div>
      </div>

      {!openWeek && <NewWeekForm />}
      {openWeek && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 26, borderLeft: "3px solid var(--sage)" }}>
          Semana <strong>{openWeek.number}</strong> está aberta ({fmt(openWeek.startDate)} –{" "}
          {fmt(openWeek.endDate)}). Feche-a antes de criar a próxima.
        </div>
      )}

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Referência</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id} className="row-click">
                <td>
                  <Link className="link-action" href={`/semanas/${w.id}`}>
                    Semana {w.number}
                  </Link>
                </td>
                <td>{fmt(w.referenceDate)}</td>
                <td>{fmt(w.startDate)}</td>
                <td>{fmt(w.endDate)}</td>
                <td>
                  <span className={`badge ${w.status === "ABERTA" ? "aberta" : "fechada"}`}>{w.status}</span>
                </td>
                <td>
                  <Link className="link-action" href={`/semanas/${w.id}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {weeks.length === 0 && (
              <tr>
                <td colSpan={6} className="table-foot-note">
                  Nenhuma semana criada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
