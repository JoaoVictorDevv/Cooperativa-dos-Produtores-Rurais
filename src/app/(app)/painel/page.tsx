import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getWeekFinancialSummary, getPendingProducerDeliveries } from "@/lib/weekSummary";
import { formatQty } from "@/lib/format";
import { Icon } from "@/components/Icon";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function fmt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

export default async function DashboardPage() {
  const week = await getOpenWeek();

  const producers = await prisma.producer.findMany({ where: { active: true } });

  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">VISÃO GERAL</div>
            <div className="page-title display">Painel operacional</div>
          </div>
        </div>

        <section className="dashboard-welcome">
          <div className="welcome-copy">
            <span className="welcome-icon"><Icon name="calendar" size={22} /></span>
            <div className="page-eyebrow">PRÓXIMO CICLO</div>
            <h2>Comece uma nova semana de operação.</h2>
            <p>Abra o período para liberar pedidos das escolas, distribuição entre produtores, entregas e o fechamento financeiro.</p>
            <div className="welcome-actions">
              <Link className="btn-primary" href="/semanas">Criar semana operacional <Icon name="arrow-right" size={17} /></Link>
              <Link className="btn-ghost" href="/historico">Consultar histórico</Link>
            </div>
          </div>
          <div className="welcome-summary">
            <div><span>Produtores ativos</span><strong>{producers.length}</strong></div>
            <div><span>Status atual</span><strong className="status-copy">Aguardando abertura</strong></div>
          </div>
        </section>

        <div className="section-title">Fluxo da operação</div>
        <div className="onboarding-grid">
          <Link href="/semanas" className="onboarding-card"><span>01</span><Icon name="calendar" /><strong>Abra a semana</strong><p>Defina o período que receberá todos os lançamentos.</p></Link>
          <Link href="/escolas" className="onboarding-card"><span>02</span><Icon name="school" /><strong>Consolide os pedidos</strong><p>Registre a demanda enviada por cada escola.</p></Link>
          <Link href="/produtores" className="onboarding-card"><span>03</span><Icon name="users" /><strong>Distribua a produção</strong><p>Organize volumes, entregas e pagamentos.</p></Link>
          <Link href="/balanco" className="onboarding-card"><span>04</span><Icon name="balance" /><strong>Feche o balanço</strong><p>Confira receitas, custos e o resultado semanal.</p></Link>
        </div>
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
          <div className="stat-label">Vendas Merenda Escolar (PMP)</div>
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
                  {p.pendingProducts.map((pp) => `${pp.productName} (${formatQty(pp.orderedQty, pp.productSlug)})`).join(", ")} — entrega ainda não registrada
                </span>
                <Link className="btn-tiny" href="/produtores">
                  Anotar
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Ir direto para</div>
      <div className="quick-grid">
        <Link className="quick-btn" href="/escolas">
          <Icon name="school" size={19} />
          <div className="qb-label">Pedido das Escolas</div>
        </Link>
        <Link className="quick-btn" href="/produtores">
          <Icon name="users" size={19} />
          <div className="qb-label">Divisão / Pedido / Entrega</div>
        </Link>
        <Link className="quick-btn" href="/balanco">
          <Icon name="balance" size={19} />
          <div className="qb-label">Fechar Balanço</div>
        </Link>
        <Link className="quick-btn" href="/historico">
          <Icon name="history" size={19} />
          <div className="qb-label">Histórico</div>
        </Link>
      </div>
    </>
  );
}
