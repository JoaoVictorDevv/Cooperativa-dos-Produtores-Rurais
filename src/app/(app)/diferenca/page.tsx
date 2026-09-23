import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getWarehouseDifferenceLines } from "@/lib/weekSummary";
import { DiferencaTable } from "./DiferencaTable";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

// Painel Diferenca do galpao (plano docs/plano-de-implementacao.md §7).
// Aceita ?week=<id> pra consultar qualquer semana do historico (aberta ou
// fechada), igual ao Resumo e ao Balanco — sem parametro, mostra a
// semana aberta atual.
export default async function DiferencaPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekIdParam } = await searchParams;
  const week = weekIdParam ? await prisma.week.findUnique({ where: { id: weekIdParam } }) : await getOpenWeek();

  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">SEM SEMANA ABERTA</div>
            <div className="page-title display">Diferença do galpão</div>
          </div>
        </div>
        <p>
          Não há nenhuma semana aberta. <Link className="link-action" href="/historico">Consulte o histórico</Link> para
          ver a diferença de uma semana já fechada.
        </p>
      </>
    );
  }

  const lines = await getWarehouseDifferenceLines(week.id);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">SEMANA {week.number}</div>
          <div className="page-title display">Diferença do galpão</div>
        </div>
        <div className="week-pill">
          <span>
            {fmt(week.startDate)} – {fmt(week.endDate)}
          </span>
          <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
        </div>
      </div>

      <DiferencaTable lines={lines} />
    </>
  );
}
