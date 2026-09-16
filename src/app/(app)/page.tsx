import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getWeekFinancialSummary, getPendingProducerDeliveries } from "@/lib/weekSummary";
import { getProducerPnaeUsage } from "@/lib/pnae";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

export default async function DashboardPage() {
  const week = await getOpenWeek();

  const producers = await prisma.producer.findMany({ where: { active: true } });
  const pnaeAlerts = (
    await Promise.all(
      producers.map(async (p) => ({ producer: p, usage: await getProducerPnaeUsage(prisma, p.id) })),
    )
  )
    .filter((a) => a.usage.alertLevel !== "OK")
    .sort((a, b) => b.usage.percentUsed - a.usage.percentUsed);

  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">VISÃO GERAL</div>
            <div className="page-title display">Nenhuma semana aberta</div>
          </div>
        </div>
        <p>
          <Link className="link-action" href="/semanas">
            Crie a semana operacional
          </Link>{" "}
          para começar o ciclo (pedido das escolas, divisão entre produtores, entregas e balanço).
        </p>
        {pnaeAlerts.length > 0 && <PnaeAlertsPanel alerts={pnaeAlerts} />}
      </>
    );
  }

  const [summary, pending] = await Promise.all([
    getWeekFinancialSummary(week.id),
    getPendingProducerDeliveries(week.id),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">VISÃO GERAL</div>
          <div className="page-title display">Semana {week.number}</div>
        </div>
        <div className="week-pill">
          <span>
            {fmt(week.startDate)} – {fmt(week.endDate)}
          </span>
          <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="card stat money-in">
          <div className="stat-label">A cobrar da prefeitura</div>
          <div className="stat-value">{fmtMoney(summary.treasuryTotal)}</div>
        </div>
        <div className="card stat money-out">
          <div className="stat-label">A pagar aos produtores</div>
          <div className="stat-value">{fmtMoney(summary.producersTotal)}</div>
          <div className="stat-sub">{pending.length} produtor(es) com pedido sem entrega registrada</div>
        </div>
        <div className={`card stat ${summary.balance >= 0 ? "balance-pos" : "balance-neg"}`}>
          <div className="stat-label">Saldo da semana (após custos)</div>
          <div className={`stat-value ${summary.balance >= 0 ? "pos" : "neg"}`}>{fmtMoney(summary.balance)}</div>
          <div className="stat-sub">Margem bruta − custos reais de logística</div>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className="section-title">
            Pendências antes de fechar a semana <span className="count">{pending.length}</span>
          </div>
          <div className="pending-list">
            {pending.map((p) => (
              <div className="pending-item" key={p.producerId}>
                <span className="who">{p.producerName}</span>
                <span className="what">
                  {p.pendingProducts.map((pp) => `${pp.productName} (${pp.orderedQty.toFixed(0)} kg)`).join(", ")} — entrega ainda não registrada
                </span>
                <Link className="btn-tiny" href="/produtores">
                  Anotar
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {pnaeAlerts.length > 0 && <PnaeAlertsPanel alerts={pnaeAlerts} />}

      <div className="section-title">Ir direto para</div>
      <div className="quick-grid">
        <Link className="quick-btn" href="/escolas">
          <div className="qb-label">Pedido das Escolas</div>
        </Link>
        <Link className="quick-btn" href="/produtores">
          <div className="qb-label">Divisão / Pedido / Entrega</div>
        </Link>
        <Link className="quick-btn" href="/balanco">
          <div className="qb-label">Fechar Balanço</div>
        </Link>
        <Link className="quick-btn" href="/historico">
          <div className="qb-label">Histórico</div>
        </Link>
      </div>
    </>
  );
}

function PnaeAlertsPanel({
  alerts,
}: {
  alerts: { producer: { id: string; name: string; internalId: string }; usage: { percentUsed: number; alertLevel: string } }[];
}) {
  return (
    <>
      <div className="section-title">
        Alertas de limite anual PNAE <span className="count">{alerts.length}</span>
      </div>
      <div className="pending-list">
        {alerts.map((a) => (
          <div className="pending-item alert-item" key={a.producer.id}>
            <span className="who">{a.producer.name}</span>
            <span className="what">{a.usage.percentUsed.toFixed(0)}% do limite de R$ 40.000/ano</span>
            <Link className="btn-tiny" href={`/produtores/${a.producer.internalId}`}>
              Ver
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
