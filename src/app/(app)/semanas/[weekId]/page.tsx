import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getWeekFinancialSummary, getWarehouseDifferenceLines, getPendingProducerDeliveries } from "@/lib/weekSummary";
import { REPORT_DEFINITIONS } from "@/lib/pdf/definitions";
import { CloseButton } from "./CloseButton";
import { ReopenForm } from "./ReopenForm";

function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function fmtDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function WeekDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const user = await verifySession();

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { closedBy: true, reopenings: { include: { user: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!week) notFound();

  const [summary, differenceLines, pending] = await Promise.all([
    getWeekFinancialSummary(weekId),
    getWarehouseDifferenceLines(weekId),
    getPendingProducerDeliveries(weekId),
  ]);
  const differenceCounts = differenceLines.reduce(
    (acc, l) => ({ ...acc, [l.status]: acc[l.status] + 1 }),
    { FALTA: 0, SOBRA: 0, OK: 0 },
  );

  return (
    <>
      <Link className="back-link" href="/semanas">
        ← Voltar para Semanas
      </Link>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">
            {fmt(week.startDate)} – {fmt(week.endDate)}
          </div>
          <div className="page-title display">
            Semana {week.number} <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
          </div>
        </div>
        {week.status === "ABERTA" && <CloseButton weekId={week.id} />}
      </div>

      {week.status === "FECHADA" && week.closedAt && (
        <p className="table-foot-note" style={{ textAlign: "left" }}>
          Fechada em {fmtDateTime(week.closedAt)} por {week.closedBy?.name ?? "—"}.
        </p>
      )}

      <div className="stat-row">
        <div className="card stat money-in">
          <div className="stat-label">Vendas Merenda Escolar (PMP)</div>
          <div className="stat-value">{fmtMoney(summary.treasuryTotal)}</div>
        </div>
        <div className="card stat money-out">
          <div className="stat-label">A pagar aos produtores</div>
          <div className="stat-value">{fmtMoney(summary.producersTotal)}</div>
        </div>
        <div className={`card stat ${summary.balance >= 0 ? "balance-pos" : "balance-neg"}`}>
          <div className="stat-label">Saldo da semana</div>
          <div className={`stat-value ${summary.balance >= 0 ? "pos" : "neg"}`}>{fmtMoney(summary.balance)}</div>
        </div>
      </div>

      <div className="section-title">Diferença do galpão nesta semana</div>
      <div className="stat-row">
        <div className="card stat" style={{ color: differenceCounts.FALTA > 0 ? "var(--brick)" : undefined }}>
          <div className="stat-label">Produtos em falta</div>
          <div className="stat-value">{differenceCounts.FALTA}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Produtos com sobra</div>
          <div className="stat-value">{differenceCounts.SOBRA}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Produtos OK</div>
          <div className="stat-value">{differenceCounts.OK}</div>
        </div>
      </div>
      {pending.length > 0 && (
        <p className="table-foot-note" style={{ textAlign: "left" }}>
          {pending.length} produtor(es) com pedido lançado e entrega ainda não registrada.
        </p>
      )}

      <div className="quick-grid">
        <Link className="quick-btn" href={`/escolas?week=${week.id}`}>
          <div className="qb-label">Pedido das Escolas</div>
        </Link>
        <Link className="quick-btn" href={`/produtores?week=${week.id}`}>
          <div className="qb-label">Divisão / Pedido / Entrega</div>
        </Link>
        <Link className="quick-btn" href={`/diferenca?week=${week.id}`}>
          <div className="qb-label">Diferença do galpão</div>
        </Link>
        <Link className="quick-btn" href={`/resumo?week=${week.id}`}>
          <div className="qb-label">Resumo</div>
        </Link>
        <Link className="quick-btn" href={`/balanco?week=${week.id}`}>
          <div className="qb-label">Balanço Financeiro</div>
        </Link>
      </div>

      <div className="section-title">Documentos da semana</div>
      <div className="quick-grid">
        {REPORT_DEFINITIONS.map((r) => (
          <a key={r.key} className="quick-btn" href={`/api/semanas/${week.id}/pdf/${r.key}`}>
            <div className="qb-label">{r.label}</div>
          </a>
        ))}
      </div>
      <div className="rm-actions" style={{ marginTop: 12 }}>
        <a className="btn-primary" href={`/api/semanas/${week.id}/pdf/zip`}>
          Baixar tudo (.zip)
        </a>
      </div>
      <p className="table-foot-note" style={{ textAlign: "left" }}>
        Os documentos usam os preços e quantidades registrados nesta semana. Nomes e endereços de escolas/produtores
        refletem o cadastro atual (não têm histórico próprio).
        {week.status === "ABERTA" && " Esta semana ainda está ABERTA — os valores podem mudar até o fechamento."}
      </p>

      {week.reopenings.length > 0 && (
        <>
          <div className="section-title">
            Histórico de reaberturas <span className="count">{week.reopenings.length}</span>
          </div>
          <div className="card">
            {week.reopenings.map((r) => (
              <div key={r.id} className="audit-row">
                <span>
                  {r.user.name} — {r.reason}
                </span>
                <span className="mono">{fmtDateTime(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {week.status === "FECHADA" && user.role === "ADMIN" && (
        <div style={{ marginTop: 26 }}>
          <ReopenForm weekId={week.id} />
        </div>
      )}
    </>
  );
}
