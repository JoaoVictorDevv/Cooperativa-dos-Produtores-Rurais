"use client";

import { useId, useMemo, useState } from "react";
import { evaluateLedgerLine, executeCommand, type Actor, type CommandResult, type CycleCommand, type CycleLedger, type SupplySource } from "@/lib/domain/cycleLedger";
import { fmtQty, newSubmissionKey, parseQty, type CycleCoreNames } from "./labels";

const field = { display: "grid", gap: 4, fontSize: 12.5 } as const;
const input = { width: "100%", maxWidth: 180 } as const;

// Registrar a entrega inicial ou um complemento de uma escola/produto.
// Mostra a prévia do resultado (aceito, falta/excedente, avisos) antes de
// confirmar. A chave de envio é fixa enquanto o formulário estiver aberto:
// duplo clique ou reenvio não duplicam o registro.
export function EventForm(props: {
  kind: "INICIAL" | "COMPLEMENTO";
  ledger: CycleLedger;
  schoolId: string;
  productId: string;
  unit: string;
  actor: Actor;
  names: CycleCoreNames;
  producerIds: string[];
  reasonOptions: string[];
  onSubmit: (command: CycleCommand) => Promise<CommandResult>;
  onDone: (message: string, warnings: string[]) => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const [key] = useState(newSubmissionKey);
  const [presented, setPresented] = useState("");
  const [rejected, setRejected] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [hasLoss, setHasLoss] = useState(false);
  const [loss, setLoss] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [sourceValue, setSourceValue] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplement = props.kind === "COMPLEMENTO";
  const source = useMemo<SupplySource | null>(
    () => (!sourceValue ? null : sourceValue === "SALDO_GALPAO" ? { type: "SALDO_GALPAO" } : { type: "PRODUTOR", producerId: sourceValue }),
    [sourceValue],
  );
  const rejectedQty = parseQty(rejected) ?? 0;

  const command = useMemo(() => {
    const common = {
      idempotencyKey: key,
      schoolId: props.schoolId,
      productId: props.productId,
      presentedQty: parseQty(presented),
      rejectedQty,
      rejectionReason: rejectedQty > 0 ? rejectionReason : null,
      lossBeforeSchoolQty: hasLoss ? (parseQty(loss) ?? 0) : 0,
      lossReason: hasLoss ? lossReason : null,
      deliveredAt: deliveredAt || null,
      receivedBy: receivedBy || null,
    };
    return isComplement
      ? ({ type: "REGISTRAR_COMPLEMENTO", ...common, source: source as SupplySource } satisfies CycleCommand)
      : ({ type: "REGISTRAR_ENTREGA_INICIAL", ...common, source } satisfies CycleCommand);
  }, [key, props.schoolId, props.productId, presented, rejectedQty, rejectionReason, hasLoss, loss, lossReason, deliveredAt, receivedBy, isComplement, source]);

  // Prévia local com a mesma regra do servidor. Quem decide é o servidor.
  const preview = useMemo(() => {
    if (presented.trim() === "") return null;
    const r = executeCommand(props.ledger, command, props.actor, { now: new Date().toISOString(), newId: () => "previa" });
    if (!r.ok) return { error: r.error };
    return { line: evaluateLedgerLine(r.ledger, props.schoolId, props.productId), warnings: r.warnings };
  }, [presented, command, props.ledger, props.actor, props.schoolId, props.productId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await props.onSubmit(command);
      if (!r.ok) setError(r.error);
      else props.onDone(r.effect === "JA_REGISTRADO" ? "Este envio já estava registrado; nada foi duplicado." : isComplement ? "Complemento registrado." : "Entrega inicial registrada.", r.warnings);
    } catch {
      setError("Falha de comunicação. Nada foi confirmado; tente de novo — o mesmo envio não será duplicado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, background: "var(--bg)" }}>
      <strong style={{ fontSize: 13.5 }}>{isComplement ? "Registrar complemento" : "Registrar entrega inicial"}</strong>
      {isComplement && (
        <p className="stat-sub" style={{ margin: 0 }}>
          Complemento é uma <strong>nova entrega física</strong> no mesmo ciclo. Não apaga a entrega inicial, suas rejeições nem horários. Para
          corrigir um número digitado errado, use &quot;Corrigir&quot; no lançamento.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={field} htmlFor={`${ids}-p`}>
          Quantidade entregue ({props.unit})
          <input id={`${ids}-p`} className="cell-input" style={input} inputMode="decimal" value={presented} onChange={(e) => setPresented(e.target.value)} placeholder={isComplement ? "" : "0 = nada entregue"} />
        </label>
        <label style={field} htmlFor={`${ids}-r`}>
          Rejeitado pela escola ({props.unit})
          <input id={`${ids}-r`} className="cell-input" style={input} inputMode="decimal" value={rejected} onChange={(e) => setRejected(e.target.value)} placeholder="0" />
        </label>
        {rejectedQty > 0 && (
          <label style={field} htmlFor={`${ids}-rr`}>
            Motivo da rejeição
            <input id={`${ids}-rr`} className="cell-input" style={{ ...input, maxWidth: 260 }} list={`${ids}-reasons`} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          </label>
        )}
        <label style={field} htmlFor={`${ids}-s`}>
          {isComplement ? "Origem do produto (obrigatório)" : "Produtor de origem (opcional)"}
          <select id={`${ids}-s`} className="cell-input" style={{ ...input, maxWidth: 240 }} value={sourceValue} onChange={(e) => setSourceValue(e.target.value)}>
            <option value="">{isComplement ? "Escolha…" : "Não informado"}</option>
            {props.producerIds.map((id) => (
              <option key={id} value={id}>
                {props.names.producers[id] ?? id}
              </option>
            ))}
            <option value="SALDO_GALPAO">Saldo já recebido no galpão</option>
          </select>
        </label>
        <label style={field} htmlFor={`${ids}-d`}>
          Data e horário reais da entrega
          <input id={`${ids}-d`} type="datetime-local" className="cell-input" style={{ ...input, maxWidth: 210 }} value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
        </label>
        <label style={field} htmlFor={`${ids}-rb`}>
          Recebido por (romaneio)
          <input id={`${ids}-rb`} className="cell-input" style={{ ...input, maxWidth: 220 }} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
        </label>
      </div>
      <label style={{ fontSize: 12.5 }}>
        <input type="checkbox" checked={hasLoss} onChange={(e) => setHasLoss(e.target.checked)} /> Houve perda antes de chegar à escola (transporte/manuseio)
      </label>
      {hasLoss && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <label style={field} htmlFor={`${ids}-l`}>
            Perda antes da escola ({props.unit})
            <input id={`${ids}-l`} className="cell-input" style={input} inputMode="decimal" value={loss} onChange={(e) => setLoss(e.target.value)} />
          </label>
          <label style={field} htmlFor={`${ids}-lr`}>
            Motivo da perda
            <input id={`${ids}-lr`} className="cell-input" style={{ ...input, maxWidth: 260 }} list={`${ids}-reasons`} value={lossReason} onChange={(e) => setLossReason(e.target.value)} />
          </label>
        </div>
      )}
      <datalist id={`${ids}-reasons`}>
        {props.reasonOptions.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {preview && (
        <div style={{ fontSize: 12.5 }} aria-live="polite">
          {"error" in preview ? (
            <span style={{ color: "var(--brick)" }}>{preview.error}</span>
          ) : (
            <>
              <span>
                Depois de confirmar: aceito <strong className="mono">{fmtQty(preview.line.acceptedQty)}</strong> de{" "}
                <span className="mono">{fmtQty(preview.line.orderedQty)}</span> {props.unit}
                {preview.line.shortageQty > 0 && (
                  <>
                    {" "}
                    · falta <strong className="mono">{fmtQty(preview.line.shortageQty)}</strong>
                  </>
                )}
                {preview.line.excessQty > 0 && (
                  <>
                    {" "}
                    · excedente <strong className="mono">{fmtQty(preview.line.excessQty)}</strong>
                  </>
                )}
                .
              </span>
              {preview.warnings.map((w) => (
                <div key={w} style={{ color: "#7a5c0a" }}>
                  ⚠ {w}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--brick)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" disabled={busy || !preview || "error" in preview} onClick={submit}>
          {busy ? "Registrando…" : isComplement ? "Confirmar complemento" : "Confirmar entrega"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={props.onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
