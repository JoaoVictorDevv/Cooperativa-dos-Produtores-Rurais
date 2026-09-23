import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOpenWeek } from "@/lib/week";
import { getWeekFinancialSummary } from "@/lib/weekSummary";
import { formatQty } from "@/lib/format";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// CA-RES-04/05: aceita ?week=<id> para consultar qualquer semana do
// historico com os valores originais dela — sem parametro, mostra a
// semana aberta atual.
export default async function ResumoPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekIdParam } = await searchParams;
  const week = weekIdParam ? await prisma.week.findUnique({ where: { id: weekIdParam } }) : await getOpenWeek();
  if (!week) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">SEM SEMANA ABERTA</div>
            <div className="page-title display">Resumo</div>
          </div>
        </div>
        <p>
          Não há nenhuma semana aberta. <Link className="link-action" href="/semanas">Crie uma semana</Link> para ver o resumo.
        </p>
      </>
    );
  }

  const summary = await getWeekFinancialSummary(week.id);

  const byProduct = new Map<string, { productName: string; productSlug: string; ordered: number; returned: number; net: number; price: number; value: number }>();
  for (const l of summary.treasuryLines) {
    const cur = byProduct.get(l.productId) ?? { productName: l.productName, productSlug: l.productSlug, ordered: 0, returned: 0, net: 0, price: l.price, value: 0 };
    cur.ordered += l.orderedQty;
    cur.returned += l.returnedQty;
    cur.net += l.netQty;
    cur.value += l.value;
    byProduct.set(l.productId, cur);
  }

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
          <div className="page-eyebrow">SEMANA {week.number}</div>
          <div className="page-title display">Resumo</div>
        </div>
        <span className={`badge ${week.status === "ABERTA" ? "aberta" : "fechada"}`}>{week.status}</span>
      </div>
      <p className="table-foot-note" style={{ textAlign: "left", marginTop: -8 }}>
        <Link className="link-action" href={`/semanas/${week.id}`}>
          Ver semana completa (documentos, diferença, balanço) →
        </Link>
      </p>

      <div className="stat-row">
        <div className="card stat money-in">
          <div className="stat-label">Vendas Merenda Escolar (PMP)</div>
          <div className="stat-value">{fmtMoney(summary.treasuryTotal)}</div>
        </div>
        <div className="card stat money-out">
          <div className="stat-label">A pagar aos produtores</div>
          <div className="stat-value">{fmtMoney(summary.producersTotal)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Margem bruta</div>
          <div className="stat-value">{fmtMoney(summary.grossMargin)}</div>
          <div className="stat-sub">Valor prefeitura − valor produtores</div>
        </div>
      </div>

      <div className="section-title">🏫 Escolas — pedido × devolução × valor a cobrar</div>
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Pedido</th>
              <th>Devolução</th>
              <th>Líquido</th>
              <th>Preço/kg</th>
              <th>Valor a cobrar</th>
            </tr>
          </thead>
          <tbody>
            {[...byProduct.values()].map((p) => (
              <tr key={p.productName}>
                <td>{p.productName}</td>
                <td className="mono">{formatQty(p.ordered, p.productSlug)}</td>
                <td className="mono">{formatQty(p.returned, p.productSlug)}</td>
                <td className="mono">{formatQty(p.net, p.productSlug)}</td>
                <td className="mono">{fmtMoney(p.price)}</td>
                <td className="mono">{fmtMoney(p.value)}</td>
              </tr>
            ))}
            {byProduct.size === 0 && (
              <tr>
                <td colSpan={6} className="table-foot-note">
                  Nenhum pedido lançado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section-title">🌾 Produtores — valor a pagar</div>
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produtor</th>
              <th>Valor a pagar</th>
            </tr>
          </thead>
          <tbody>
            {[...byProducer.values()].map((p) => (
              <tr key={p.producerName}>
                <td>{p.producerName}</td>
                <td className="mono">{fmtMoney(p.total)}</td>
              </tr>
            ))}
            {byProducer.size === 0 && (
              <tr>
                <td colSpan={2} className="table-foot-note">
                  Nenhuma entrega registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
