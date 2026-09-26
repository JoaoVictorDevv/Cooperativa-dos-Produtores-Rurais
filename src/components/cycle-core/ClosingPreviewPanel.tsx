import type { CycleSummary } from "@/lib/domain/cycle";
import type { LedgerClosingPreview } from "@/lib/domain/cycleLedger";
import { CYCLE_STATE_LABEL, fmtMoney, fmtQty, type CycleCoreNames } from "./labels";

// Três indicadores separados (RN-10): recebimentos conferidos, valores
// calculados e pronto para fechar — nunca um único "OK". Mostra o que bloqueia
// e a prévia de valores. Não fecha nada.
export function ClosingPreviewPanel({ preview, summary, names }: { preview: LedgerClosingPreview; summary: CycleSummary; names: CycleCoreNames }) {
  const indicators: [string, boolean][] = [
    ["Recebimentos conferidos", summary.receiptsConferred],
    ["Valores calculados", summary.valuesCalculated],
    ["Pronto para fechar", preview.canClose],
  ];
  return (
    <section className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }} aria-label="Prévia de fechamento">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <strong style={{ fontSize: 15 }}>Situação do ciclo: {CYCLE_STATE_LABEL[summary.state]}</strong>
        {indicators.map(([label, ok]) => (
          <span key={label} className={`badge ${ok ? "ok" : "atencao"}`}>
            {ok ? "✓" : "…"} {label}
          </span>
        ))}
      </div>

      {preview.blockers.length > 0 && (
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>
            O que impede o fechamento
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {preview.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.warnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#7a5c0a" }}>
          {preview.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="stat-row">
        <div className="card stat money-in">
          <div className="stat-label">A cobrar (aceito na escola)</div>
          <div className="stat-value">{fmtMoney(preview.receivableTotal)}</div>
        </div>
        <div className="card stat money-out">
          <div className="stat-label">A pagar (aceito no galpão)</div>
          <div className="stat-value">{fmtMoney(preview.payableTotal)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Resultado calculado</div>
          <div className="stat-value">{fmtMoney(preview.calculatedResult)}</div>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Pedido</th>
              <th>Aceito na escola</th>
              <th>Falta conferida</th>
              <th>Falta encerrada</th>
              <th>Excedente</th>
              <th>Rejeição galpão</th>
              <th>Rejeição escola</th>
              <th>Perda antes da escola</th>
              <th>Atendimento</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(preview.totalsByUnit).map(([unit, t]) => (
              <tr key={unit}>
                <td>{unit}</td>
                <td className="mono">{fmtQty(t!.orderedQty)}</td>
                <td className="mono">{fmtQty(t!.acceptedAtSchoolQty)}</td>
                <td className="mono">{fmtQty(t!.shortageQty)}</td>
                <td className="mono">{fmtQty(t!.shortageClosedQty)}</td>
                <td className="mono">{fmtQty(t!.excessQty)}</td>
                <td className="mono">{fmtQty(t!.rejectedAtWarehouseQty)}</td>
                <td className="mono">{fmtQty(t!.rejectedAtSchoolQty)}</td>
                <td className="mono">{fmtQty(t!.lossBeforeSchoolQty)}</td>
                <td className="mono">{summary.attendanceByUnit[unit as "kg"] === null ? "n/a" : `${fmtQty(summary.attendanceByUnit[unit as "kg"])}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.closedShortages.length > 0 && (
        <div style={{ fontSize: 13 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            Faltas encerradas sem atendimento (ficam no histórico; não passam para o próximo ciclo)
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {preview.closedShortages.map((s) => (
              <li key={`${s.schoolId}:${s.productId}`}>
                {names.schools[s.schoolId] ?? s.schoolId} — {names.products[s.productId] ?? s.productId}: {fmtQty(s.qty)} {s.unit} — “{s.reason}”
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="table-foot-note" style={{ textAlign: "left", margin: 0 }}>
        Valores calculados, não quitação. Cada linha é arredondada a centavos e o total é a soma das linhas.
      </p>
    </section>
  );
}
