"use client";

import { useState } from "react";
import type { SchoolLineResult } from "@/lib/domain/cycle";
import type { Actor, CommandResult, CycleCommand, CycleLedger } from "@/lib/domain/cycleLedger";
import { EventCorrectionForm } from "./EventCorrectionForm";
import { EventForm } from "./EventForm";
import { ShortageDecisionForm } from "./ShortageDecisionForm";
import { ATTENDANCE_LABEL, RECEIPT_LABEL, SHORTAGE_LABEL, fmtDateTime, fmtQty, sourceLabel, type CycleCoreNames } from "./labels";

type Open = { form: "INICIAL" | "COMPLEMENTO" } | { form: "CORRIGIR"; eventId: string } | null;

// Uma escola × produto no ciclo: pedido, entregas e complementos (cada um
// preservado), aceito, falta/excedente e a decisão da falta. Não conhece a
// persistência: recebe o estado e uma função que executa comandos.
export function SchoolLinePanel(props: {
  ledger: CycleLedger;
  line: SchoolLineResult;
  actor: Actor;
  names: CycleCoreNames;
  producerIds: string[];
  reasonOptions: string[];
  readOnly: boolean;
  onCommand: (command: CycleCommand) => Promise<CommandResult>;
  domId?: string;
  highlighted?: boolean;
}) {
  const { ledger, line, names } = props;
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState<{ text: string; warnings: string[] } | null>(null);
  // Entrega inicial primeiro; complementos na ordem em que foram registrados.
  const events = ledger.events
    .filter((e) => e.schoolId === line.schoolId && e.productId === line.productId)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "INICIAL" ? -1 : 1));
  const complementNumber = new Map(events.filter((e) => e.kind === "COMPLEMENTO").map((e, i) => [e.id, i + 1]));
  const decision = ledger.decisions.find((d) => d.schoolId === line.schoolId && d.productId === line.productId) ?? null;
  const hasInitial = events.some((e) => e.kind === "INICIAL");
  const shortageBadge = SHORTAGE_LABEL[line.shortageStatus];
  const title = `${names.schools[line.schoolId] ?? line.schoolId} — ${names.products[line.productId] ?? line.productId}`;

  const done = (text: string, warnings: string[]) => {
    setOpen(null);
    setMessage({ text, warnings });
  };
  const formProps = { ledger, actor: props.actor, reasonOptions: props.reasonOptions, onSubmit: props.onCommand, onDone: done, onCancel: () => setOpen(null) };
  const correcting = open?.form === "CORRIGIR" ? events.find((e) => e.id === open.eventId) : undefined;

  return (
    <section
      id={props.domId}
      className="card"
      style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, scrollMarginTop: 80, outline: props.highlighted ? "2px solid var(--sage)" : undefined }}
      aria-label={title}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[RECEIPT_LABEL[line.receiptStatus], ATTENDANCE_LABEL[line.attendance], shortageBadge].filter(Boolean).map((b) => (
            <span key={b![0]} className={`badge ${b![1]}`}>
              {b![0]}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", fontSize: 13 }}>
        <span>
          Pedido <strong className="mono">{fmtQty(line.orderedQty)}</strong> {line.unit}
        </span>
        <span>
          Aceito pela escola <strong className="mono">{fmtQty(line.acceptedQty)}</strong>
          {line.receiptStatus === "PENDENTE_CONFERENCIA" && <span className="stat-sub"> (parcial)</span>}
        </span>
        <span style={line.shortageQty > 0 ? { color: "var(--brick)" } : undefined}>
          Falta <strong className="mono">{fmtQty(line.shortageQty)}</strong>
        </span>
        {line.excessQty > 0 && (
          <span>
            Excedente <strong className="mono">{fmtQty(line.excessQty)}</strong>
          </span>
        )}
        <span>
          Rejeição na escola <span className="mono">{fmtQty(line.rejectedAtSchoolQty)}</span>
        </span>
        {line.lossBeforeSchoolQty > 0 && (
          <span>
            Perda antes da escola <span className="mono">{fmtQty(line.lossBeforeSchoolQty)}</span>
          </span>
        )}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Lançamento</th>
              <th>Entregue</th>
              <th>Rejeitado</th>
              <th>Perda antes</th>
              <th>Origem</th>
              <th>Entrega real</th>
              <th>Recebido por</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.kind === "INICIAL" ? "Entrega inicial" : `Complemento ${complementNumber.get(e.id)}`}
                  {e.version > 1 && <span className="stat-sub"> · corrigido (v{e.version})</span>}
                </td>
                <td className="mono">{e.presentedQty === null ? "não informado" : fmtQty(e.presentedQty)}</td>
                <td className="mono">
                  {fmtQty(e.rejectedQty)}
                  {e.rejectionReason && <div className="stat-sub">{e.rejectionReason}</div>}
                </td>
                <td className="mono">
                  {fmtQty(e.lossBeforeSchoolQty)}
                  {e.lossReason && <div className="stat-sub">{e.lossReason}</div>}
                </td>
                <td>{sourceLabel(e.source, names)}</td>
                <td>{fmtDateTime(e.deliveredAt)}</td>
                <td>{e.receivedBy ?? "—"}</td>
                <td>
                  {!props.readOnly && (
                    <button type="button" className="btn-tiny" onClick={() => setOpen({ form: "CORRIGIR", eventId: e.id })}>
                      Corrigir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="table-foot-note" style={{ textAlign: "left" }}>
                  Nenhuma entrega registrada — pendente de conferência (vazio não é zero).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!props.readOnly && !open && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!hasInitial && (
            <button type="button" className="btn-ghost" onClick={() => setOpen({ form: "INICIAL" })}>
              Registrar entrega inicial
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => setOpen({ form: "COMPLEMENTO" })}>
            + Complemento
          </button>
        </div>
      )}
      {open && open.form !== "CORRIGIR" && (
        <EventForm {...formProps} kind={open.form} schoolId={line.schoolId} productId={line.productId} unit={line.unit} names={names} producerIds={props.producerIds} />
      )}
      {correcting && <EventCorrectionForm {...formProps} event={correcting} unit={line.unit} />}

      {!props.readOnly && (line.shortageQty > 0 || decision) && <ShortageDecisionForm line={line} decision={decision} onSubmit={props.onCommand} onDone={done} />}

      {message && (
        <div role="status" style={{ fontSize: 13 }}>
          <span style={{ color: "var(--forest)" }}>{message.text}</span>
          {message.warnings.map((w) => (
            <div key={w} style={{ color: "#7a5c0a" }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
