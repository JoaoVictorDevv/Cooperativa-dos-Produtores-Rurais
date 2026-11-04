"use client";

import { useMemo, useState } from "react";
import { attendanceReport, type AttendanceRow } from "@/lib/cycleCore/documents";
import type { CycleLedger } from "@/lib/domain/cycleLedger";
import { fmtQty, type CycleCoreNames } from "./labels";

type Tone = "ok" | "atencao" | "estourado" | "fechada";

// Cor + texto por situação (nunca só a cor): falta em resolução e encerrada
// sem atendimento são diferentes; pendente de conferência não é zero.
function tone(r: AttendanceRow): Tone {
  if (r.pending) return "atencao";
  if (r.situation.startsWith("Falta encerrada")) return "fechada";
  if (r.shortageQty > 0 || r.situation.startsWith("Decisão") || r.situation === "Com erro") return "estourado";
  if (r.excessQty > 0) return "atencao";
  return "ok";
}

type Filter = "TODAS" | "PENDENTES" | "FALTAS" | "EXCEDENTES";

// Visão de atendimento das escolas (prompt v2 §10): pedido, aceito,
// falta/excedente, rejeições e situação, por escola e produto, com totais por
// unidade. Clicar numa linha abre o detalhe daquela escola/produto.
export function AttendanceSummaryTable({ ledger, names, onSelect }: { ledger: CycleLedger; names: CycleCoreNames; onSelect: (schoolId: string, productId: string) => void }) {
  const { rows, totals } = useMemo(() => attendanceReport(ledger, names), [ledger, names]);
  const [filter, setFilter] = useState<Filter>("TODAS");
  const visible = rows.filter((r) =>
    filter === "PENDENTES" ? r.pending : filter === "FALTAS" ? !r.pending && r.shortageQty > 0 : filter === "EXCEDENTES" ? r.excessQty > 0 : true,
  );
  const counts = {
    PENDENTES: rows.filter((r) => r.pending).length,
    FALTAS: rows.filter((r) => !r.pending && r.shortageQty > 0).length,
    EXCEDENTES: rows.filter((r) => r.excessQty > 0).length,
  };

  return (
    <section className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }} aria-label="Atendimento das escolas">
      <strong style={{ fontSize: 15 }}>Atendimento das escolas</strong>
      <div className="toolbar">
        {(
          [
            ["TODAS", `Todas (${rows.length})`],
            ["PENDENTES", `A conferir (${counts.PENDENTES})`],
            ["FALTAS", `Com falta (${counts.FALTAS})`],
            ["EXCEDENTES", `Com excedente (${counts.EXCEDENTES})`],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" className={`filter-chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Escola</th>
              <th>Produto</th>
              <th>Pedido</th>
              <th>Entregue</th>
              <th>Rejeitado na escola</th>
              <th>Aceito</th>
              <th>Falta</th>
              <th>Excedente</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={`${r.schoolId}:${r.productId}`}
                className="row-click"
                tabIndex={0}
                onClick={() => onSelect(r.schoolId, r.productId)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.schoolId, r.productId))}
                aria-label={`Abrir ${names.schools[r.schoolId] ?? r.schoolId}, ${names.products[r.productId] ?? r.productId}`}
              >
                <td className="name-cell">{names.schools[r.schoolId] ?? r.schoolId}</td>
                <td>{names.products[r.productId] ?? r.productId}</td>
                <td className="mono">
                  {fmtQty(r.orderedQty)} {r.unit}
                </td>
                <td className="mono">
                  {fmtQty(r.presentedQty)}
                  {r.pending && <span className="stat-sub"> parcial</span>}
                  {r.complementCount > 0 && <span className="stat-sub"> · {r.complementCount} compl.</span>}
                </td>
                <td className="mono">{fmtQty(r.rejectedAtSchoolQty)}</td>
                <td className="mono">{fmtQty(r.acceptedQty)}</td>
                <td className="mono">{r.pending ? "a conferir" : fmtQty(r.shortageQty)}</td>
                <td className="mono">{fmtQty(r.excessQty)}</td>
                <td>
                  <span className={`badge ${tone(r)}`}>{r.situation}</span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="table-foot-note" style={{ textAlign: "left" }}>
                  Nenhuma linha neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 22px", fontSize: 13 }}>
        {totals.map((t) => (
          <span key={t.unit}>
            <strong>{t.unit}</strong>: pedido {fmtQty(t.orderedQty)} · aceito {fmtQty(t.acceptedQty)} · falta conferida {fmtQty(t.shortageQty)} (encerrada{" "}
            {fmtQty(t.shortageClosedQty)}){t.pendingLines > 0 && ` · ${t.pendingLines} linha(s) a conferir`} · excedente {fmtQty(t.excessQty)} · atendimento{" "}
            {t.attendancePercent === null ? "n/a" : `${fmtQty(t.attendancePercent)}%${t.pendingLines > 0 ? " (parcial)" : ""}`}
          </span>
        ))}
      </div>
      <p className="table-foot-note" style={{ textAlign: "left", margin: 0 }}>
        Atendimento: cada linha conta no máximo o próprio pedido — o excedente de uma escola não cobre a falta de outra; demanda zero = n/a. kg e dz
        nunca são somados. &quot;Entregue&quot; parcial = ainda há entrega não conferida.
      </p>
    </section>
  );
}
