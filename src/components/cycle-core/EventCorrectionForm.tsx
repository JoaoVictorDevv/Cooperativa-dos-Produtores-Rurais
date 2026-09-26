"use client";

import { useId, useMemo, useState } from "react";
import { evaluateLedgerLine, executeCommand, type Actor, type CommandResult, type CycleCommand, type CycleLedger, type DeliveryEvent } from "@/lib/domain/cycleLedger";
import { fmtQty, parseQty } from "./labels";

const field = { display: "grid", gap: 4, fontSize: 12.5 } as const;

// Correção de um lançamento errado: altera o mesmo evento (não cria nova
// entrega), exige motivo e usa a versão aberta na tela para detectar que
// outra pessoa corrigiu antes.
export function EventCorrectionForm(props: {
  ledger: CycleLedger;
  event: DeliveryEvent;
  unit: string;
  actor: Actor;
  reasonOptions: string[];
  onSubmit: (command: CycleCommand) => Promise<CommandResult>;
  onDone: (message: string, warnings: string[]) => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const e = props.event;
  const [presented, setPresented] = useState(e.presentedQty === null ? "" : String(e.presentedQty));
  const [rejected, setRejected] = useState(String(e.rejectedQty));
  const [rejectionReason, setRejectionReason] = useState(e.rejectionReason ?? "");
  const [loss, setLoss] = useState(String(e.lossBeforeSchoolQty));
  const [lossReason, setLossReason] = useState(e.lossReason ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const command = useMemo<Extract<CycleCommand, { type: "CORRIGIR_EVENTO" }>>(
    () => ({
      type: "CORRIGIR_EVENTO",
      eventId: e.id,
      expectedVersion: e.version,
      reason,
      changes: {
        presentedQty: parseQty(presented),
        rejectedQty: parseQty(rejected) ?? 0,
        rejectionReason: rejectionReason || null,
        lossBeforeSchoolQty: parseQty(loss) ?? 0,
        lossReason: lossReason || null,
      },
    }),
    [e.id, e.version, reason, presented, rejected, rejectionReason, loss, lossReason],
  );

  const preview = useMemo(() => {
    const r = executeCommand(props.ledger, { ...command, reason: reason || "prévia" }, props.actor, { now: new Date().toISOString(), newId: () => "previa" });
    if (!r.ok) return { error: r.error };
    if (r.effect === "JA_REGISTRADO") return { unchanged: true as const };
    return { line: evaluateLedgerLine(r.ledger, e.schoolId, e.productId), warnings: r.warnings };
  }, [command, reason, props.ledger, props.actor, e.schoolId, e.productId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await props.onSubmit(command);
      if (!r.ok) setError(r.error);
      else props.onDone(r.effect === "JA_REGISTRADO" ? "Nada mudou." : "Correção registrada na auditoria.", r.warnings);
    } catch {
      setError("Falha de comunicação. Nada foi confirmado; tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && reason.trim().length > 0 && !("error" in preview) && !("unchanged" in preview);
  return (
    <div className="card" style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, background: "var(--bg)" }}>
      <strong style={{ fontSize: 13.5 }}>Corrigir lançamento (versão {e.version})</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={field} htmlFor={`${ids}-p`}>
          Entregue ({props.unit})
          <input id={`${ids}-p`} className="cell-input" style={{ width: 110 }} inputMode="decimal" value={presented} onChange={(ev) => setPresented(ev.target.value)} />
        </label>
        <label style={field} htmlFor={`${ids}-r`}>
          Rejeitado ({props.unit})
          <input id={`${ids}-r`} className="cell-input" style={{ width: 110 }} inputMode="decimal" value={rejected} onChange={(ev) => setRejected(ev.target.value)} />
        </label>
        <label style={field} htmlFor={`${ids}-rr`}>
          Motivo da rejeição
          <input id={`${ids}-rr`} className="cell-input" style={{ width: 220 }} list={`${ids}-reasons`} value={rejectionReason} onChange={(ev) => setRejectionReason(ev.target.value)} />
        </label>
        <label style={field} htmlFor={`${ids}-l`}>
          Perda antes da escola ({props.unit})
          <input id={`${ids}-l`} className="cell-input" style={{ width: 110 }} inputMode="decimal" value={loss} onChange={(ev) => setLoss(ev.target.value)} />
        </label>
        <label style={field} htmlFor={`${ids}-lr`}>
          Motivo da perda
          <input id={`${ids}-lr`} className="cell-input" style={{ width: 220 }} list={`${ids}-reasons`} value={lossReason} onChange={(ev) => setLossReason(ev.target.value)} />
        </label>
      </div>
      <datalist id={`${ids}-reasons`}>
        {props.reasonOptions.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <label style={field} htmlFor={`${ids}-why`}>
        Motivo da correção (obrigatório)
        <input id={`${ids}-why`} className="cell-input" style={{ width: "100%", maxWidth: 420 }} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Ex.: erro de digitação; recontagem" />
      </label>
      <div style={{ fontSize: 12.5 }} aria-live="polite">
        {"error" in preview ? (
          <span style={{ color: "var(--brick)" }}>{preview.error}</span>
        ) : "unchanged" in preview ? (
          <span className="stat-sub">Sem alteração.</span>
        ) : (
          <>
            Depois de corrigir: aceito <strong className="mono">{fmtQty(preview.line.acceptedQty)}</strong> · falta{" "}
            <strong className="mono">{fmtQty(preview.line.shortageQty)}</strong>
            {preview.warnings.map((w) => (
              <div key={w} style={{ color: "#7a5c0a" }}>
                ⚠ {w}
              </div>
            ))}
          </>
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--brick)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? "Registrando…" : "Confirmar correção"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={props.onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
