"use client";

import { useId, useState } from "react";
import type { SchoolLineResult } from "@/lib/domain/cycle";
import type { CommandResult, CycleCommand, ShortageDecisionRecord } from "@/lib/domain/cycleLedger";
import { fmtQty } from "./labels";

// Decisão sobre a falta de uma escola/produto (RN-09). Não existe "resolvida"
// manual: a falta só some quando o total aceito cobre o pedido (complemento).
// Para fechar com quantidade faltante, a decisão é "encerrar sem atendimento",
// com motivo, e vale para a quantidade mostrada — se a falta mudar depois, a
// decisão fica incoerente e precisa ser revista.
export function ShortageDecisionForm(props: {
  line: SchoolLineResult;
  decision: ShortageDecisionRecord | null;
  onSubmit: (command: CycleCommand) => Promise<CommandResult>;
  onDone: (message: string, warnings: string[]) => void;
}) {
  const ids = useId();
  const { line, decision } = props;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedVersion = decision?.version ?? null;
  const conferred = line.receiptStatus === "CONFERIDO";

  async function send(command: CycleCommand, done: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await props.onSubmit(command);
      if (!r.ok) setError(r.error);
      else {
        setReason("");
        props.onDone(done, r.warnings);
      }
    } catch {
      setError("Falha de comunicação. Nada foi confirmado; tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const base = { schoolId: line.schoolId, productId: line.productId };
  const showDecide = line.shortageQty > 0 && decision?.kind !== "ENCERRADA_SEM_ATENDIMENTO";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, fontSize: 12.5 }}>
      {decision && (
        <div>
          Decisão atual:{" "}
          <strong>{decision.kind === "EM_RESOLUCAO" ? "em resolução" : `encerrada sem atendimento (${fmtQty(decision.shortageQtyAtDecision)} ${line.unit})`}</strong>
          {decision.reason && <> — “{decision.reason}”</>}
        </div>
      )}
      {(showDecide || decision) && (
        <label style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4 }} htmlFor={`${ids}-why`}>
          {decision && !showDecide ? "Motivo para revogar" : "Motivo"}
          <input id={`${ids}-why`} className="cell-input" style={{ width: "100%", maxWidth: 420 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: sem produto no mercado; produtor sem colheita" />
        </label>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {showDecide && decision?.kind !== "EM_RESOLUCAO" && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => send({ type: "MARCAR_FALTA_EM_RESOLUCAO", ...base, reason, expectedVersion }, "Falta marcada como em resolução.")}>
            Marcar em resolução
          </button>
        )}
        {showDecide && (
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !conferred || reason.trim().length < 3}
            title={!conferred ? "Confira todas as entregas antes de encerrar." : undefined}
            onClick={() =>
              send({ type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", ...base, reason, expectedShortageQty: line.shortageQty, expectedVersion }, "Falta encerrada sem atendimento. Não vira pedido nem cobrança no próximo ciclo.")
            }
          >
            Encerrar falta de {fmtQty(line.shortageQty)} {line.unit} sem atendimento
          </button>
        )}
        {decision && (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !reason.trim()}
            onClick={() => send({ type: "REVOGAR_DECISAO_FALTA", ...base, reason, expectedVersion: decision.version }, "Decisão revogada.")}
          >
            Revogar decisão
          </button>
        )}
        {showDecide && !conferred && <span className="stat-sub">Encerrar só depois de conferir as entregas (vazio não é zero).</span>}
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--brick)", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
