import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getWarehouseDifferenceLines, getWeekFinancialSummary } from "@/lib/weekSummary";
import { loadCurrentCycle } from "@/lib/cycleCore/currentTables";
import { compareGalpao, type ParityCheck } from "@/lib/cycleCore/galpaoParity";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);
}
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);

const AREAS: [ParityCheck["area"], string][] = [
  ["GALPAO_TOTAL", "Total a pagar aos produtores"],
  ["CUSTOS", "Custos reais"],
  ["GALPAO_LINHA", "Galpão, linha a linha (bruto, rejeição, aceito, a pagar)"],
  ["DIFERENCA", "Diferença do galpão por produto"],
];

// Validação do ciclo fechado (docs/validacao-ciclo-fechado.md): modelo atual ×
// lógica corrigida na parte do galpão, custos e diferença. SÓ LEITURA (nenhuma
// ação, nada gravado) e só para ADMIN. Mesma comparação do script
// scripts/validate-closed-cycle.ts, rodando dentro do app — em produção, quem
// é ADMIN valida um ciclo real sem precisar de acesso ao banco.
export default async function ValidacaoCicloPage({ params }: { params: Promise<{ weekId: string }> }) {
  const user = await verifySession();
  const { weekId } = await params;
  const back = (
    <Link className="back-link" href={`/semanas/${weekId}`}>
      ← Voltar para a semana
    </Link>
  );
  if (user.role !== "ADMIN") {
    return (
      <>
        {back}
        <p role="alert">A validação do ciclo fechado é restrita a administradores.</p>
      </>
    );
  }
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) notFound();
  if (week.status !== "FECHADA") {
    return (
      <>
        {back}
        <p role="alert">A validação só é feita em ciclos fechados. A Semana {week.number} ainda está aberta.</p>
      </>
    );
  }

  const [summary, differenceLines, current] = await Promise.all([getWeekFinancialSummary(week.id), getWarehouseDifferenceLines(week.id), loadCurrentCycle(prisma, week.id)]);
  if (!current) notFound();
  const report = compareGalpao({ ...summary, differenceLines }, current);

  return (
    <>
      {back}
      <div className="page-head">
        <div>
          <div className="page-eyebrow">
            SEMANA {week.number} · {fmtDate(week.startDate)} – {fmtDate(week.endDate)} · FECHADA · SÓ LEITURA
          </div>
          <div className="page-title display">Validação do ciclo fechado</div>
        </div>
      </div>

      <div
        className="card"
        role="status"
        style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${report.ok ? "var(--forest)" : "var(--brick)"}`, fontSize: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}
      >
        <strong style={{ color: report.ok ? "var(--forest)" : "var(--brick)" }}>
          {report.ok
            ? "Confere: galpão, custos e diferença dão os mesmos números no modelo atual e na lógica corrigida."
            : `Divergência: ${report.mismatches.length} número(s) diferente(s) e ${report.anomalies.length} anomalia(s). Ver abaixo.`}
        </strong>
        <span className="stat-sub">
          Nada foi recalculado nem gravado. Esta tela compara as duas formas de calcular os mesmos dados deste ciclo.
        </span>
      </div>

      {AREAS.map(([area, title]) => {
        const checks = report.checks.filter((c) => c.area === area);
        const bad = checks.filter((c) => !c.ok).length;
        return (
          <section key={area} className="card" style={{ padding: 16, marginBottom: 16 }} aria-label={title}>
            <div className="section-title" style={{ marginTop: 0 }}>
              {title}: {checks.length - bad} de {checks.length} conferem
            </div>
            {checks.length === 0 ? (
              <p className="stat-sub">Nenhum lançamento neste ciclo.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Modelo atual</th>
                      <th>Lógica corrigida</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((c) => (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td className="mono">{fmtNum(c.legacy)}</td>
                        <td className="mono">{fmtNum(c.novo)}</td>
                        <td>
                          <span className={`badge ${c.ok ? "ok" : "estourado"}`}>{c.ok ? "Confere" : "Diverge"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {report.anomalies.length > 0 && (
        <section className="card" style={{ padding: 16, marginBottom: 16 }} aria-label="Anomalias">
          <div className="section-title" style={{ marginTop: 0 }}>
            Anomalias
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {report.anomalies.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" style={{ padding: 16, marginBottom: 16 }} aria-label="Não validado">
        <div className="section-title" style={{ marginTop: 0 }}>
          Não validado neste ciclo (e por quê)
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: "grid", gap: 6 }}>
          {report.notValidated.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="table-foot-note" style={{ textAlign: "left" }}>
          A cobrança pelo aceito na escola depende de existir onde registrar a entrega por escola e produto — bloqueio de banco/API (Lucas), não
          deste app.
        </p>
      </section>
    </>
  );
}
