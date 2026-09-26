import Link from "next/link";
import { LEGACY_BILLING_NOTE } from "@/lib/methodology";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getWeekFinancialSummary } from "@/lib/weekSummary";
import { CostCell } from "./CostCell";
import type { CostCategory } from "@prisma/client";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const COST_LABELS: Record<CostCategory, string> = {
  TRANSPORTE: "Transporte",
  MONTAGEM: "Montagem",
  ADMINISTRATIVO: "Administrativo",
  EMBALAGENS_MATERIAL_LIMPEZA: "Embalagens + Material de Limpeza",
  MATERIAL_ESCRITORIO: "Material de Escritório",
  IMPOSTOS: "Impostos",
  SERVICO_CONTABILIDADE: "Serviço de Contabilidade",
  AJUDA_CUSTO_CONSELHO: "Ajuda de Custo Conselho",
};
const COST_ORDER = Object.keys(COST_LABELS) as CostCategory[];

export default async function BalancoPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekIdParam } = await searchParams;
  const week = weekIdParam ? await prisma.week.findUnique({ where: { id: weekIdParam } }) : await getOpenWeek();
  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">SEM SEMANA ABERTA</div>
            <div className="page-title display">Balanço Financeiro</div>
          </div>
        </div>
        <p>
          Não há nenhuma semana aberta. <Link className="link-action" href="/semanas">Crie uma semana</Link> para lançar custos.
        </p>
      </>
    );
  }

  const summary = await getWeekFinancialSummary(week.id);
  const editable = week.status === "ABERTA";
  const costByCategory = new Map(summary.costs.map((c) => [c.category, c.amount]));

  const byProducer = new Map<string, { producerName: string; total: number }>();
  for (const l of summary.producerLines) {
    const cur = byProducer.get(l.producerId) ?? { producerName: l.producerName, total: 0 };
    cur.total += l.payment;
    byProducer.set(l.producerId, cur);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">SEMANA {week.number} · FECHAMENTO</div>
          <div className="page-title display">Balanço Financeiro</div>
        </div>
      </div>
      <p className="table-foot-note" style={{ textAlign: "left", marginTop: -8 }}>
        <Link className="link-action" href={`/semanas/${week.id}`}>
          Ver semana completa (documentos, diferença, produtores) →
        </Link>
      </p>

      <p className="table-foot-note" style={{ textAlign: "left" }}>
        {LEGACY_BILLING_NOTE}
      </p>
      <div className="stat-row">
        <div className="card stat money-in">
          <div className="stat-label">A cobrar — Merenda Escolar (PMP)</div>
          <div className="stat-value">{fmtMoney(summary.treasuryTotal)}</div>
        </div>
        <div className="card stat money-out">
          <div className="stat-label">A pagar aos produtores</div>
          <div className="stat-value">{fmtMoney(summary.producersTotal)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Margem bruta</div>
          <div className="stat-value">{fmtMoney(summary.grossMargin)}</div>
        </div>
      </div>

      <div className={`balance-hero${summary.balance < 0 ? " negative" : ""}`}>
        <div>
          <div className="bh-label">Resultado calculado</div>
          <div className="bh-value display">{fmtMoney(summary.balance)}</div>
          <div className="bh-formula">
            Margem bruta ({fmtMoney(summary.grossMargin)}) − Custos reais ({fmtMoney(summary.totalCosts)})
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="card">
            <div className="panel-title">Custos reais registrados nesta semana</div>
            <div className="panel-pad">
              <div className="cost-list">
                {COST_ORDER.map((category) => (
                  <div className="cost-row" key={`${week.id}-${category}`}>
                    <span className="cr-label">{COST_LABELS[category]}</span>
                    <CostCell
                      weekId={week.id}
                      category={category}
                      initialValue={costByCategory.get(category) ?? 0}
                      editable={editable}
                    />
                  </div>
                ))}
              </div>
              <div className="subtotal-row">
                <span>Total de custos</span>
                <span>{fmtMoney(summary.totalCosts)}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="panel-title">Conferência — valor a pagar por produtor</div>
            <div className="panel-pad">
              {[...byProducer.values()].map((p) => (
                <div className="audit-row" key={p.producerName}>
                  <span>{p.producerName}</span>
                  <span className="mono">{fmtMoney(p.total)}</span>
                </div>
              ))}
              <div className={`audit-total${summary.reconciliation.status === "DIVERGENCIA" ? " divergent" : ""}`}>
                <span>Total</span>
                <span>{fmtMoney(summary.reconciliation.sumIndividual)}</span>
              </div>
              <p className="stat-sub" style={{ marginTop: 8 }}>
                {summary.reconciliation.status === "OK"
                  ? "Conferência OK — soma individual bate com o total geral."
                  : `Divergência de ${fmtMoney(summary.reconciliation.difference)} entre a soma individual e o total geral.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
