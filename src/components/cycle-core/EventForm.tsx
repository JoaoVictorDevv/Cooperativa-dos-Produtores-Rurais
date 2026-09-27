"use client";

import { useId, useMemo, useState } from "react";
import { evaluateLedgerLine, executeCommand, type Actor, type CommandResult, type ComplementTrip, type CycleCommand, type CycleLedger, type SupplySource } from "@/lib/domain/cycleLedger";
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
  const [trip, setTrip] = useState<ComplementTrip | "">("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplement = props.kind === "COMPLEMENTO";
  // Mesma viagem (RN-22): romaneio único; aqui só a origem e a quantidade.
  const sameTrip = isComplement && trip === "MESMA_VIAGEM";
  const source = useMemo<SupplySource | null>(
    () => (!sourceValue ? null : sourceValue === "SALDO_GALPAO" ? { type: "SALDO_GALPAO" } : { type: "PRODUTOR", producerId: sourceValue }),
    [sourceValue],
  );
  const rejectedQty = sameTrip ? 0 : (parseQty(rejected) ?? 0);

  const command = useMemo(() => {
    const common = {
      idempotencyKey: key,
      schoolId: props.schoolId,
      productId: props.productId,
      presentedQty: parseQty(presented),
      rejectedQty,
      rejectionReason: rejectedQty > 0 ? rejectionReason : null,
      lossBeforeSchoolQty: hasLoss && !sameTrip ? (parseQty(loss) ?? 0) : 0,
      lossReason: hasLoss && !sameTrip ? lossReason : null,
      deliveredAt: sameTrip ? null : deliveredAt || null,
      receivedBy: sameTrip ? null : receivedBy || null,
    };
    // Sem viagem escolhida, o domínio recusa com a mensagem certa.
    return isComplement
      ? ({ type: "REGISTRAR_COMPLEMENTO", ...common, source: source as SupplySource, trip: trip as ComplementTrip } satisfies CycleCommand)
      : ({ type: "REGISTRAR_ENTREGA_INICIAL", ...common, source } satisfies CycleCommand);
  }, [key, props.schoolId, props.productId, presented, rejectedQty, rejectionReason, hasLoss, loss, lossReason, deliveredAt, receivedBy, isComplement, source, trip, sameTrip]);

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
          Complemento é produto de outra origem para cobrir a falta, no mesmo ciclo. Não apaga a entrega inicial, suas rejeições nem horários.
          Para corrigir um número digitado errado, use &quot;Corrigir&quot; no lançamento.
        </p>
      )}
      {!isComplement && (
        <p className="stat-sub" style={{ margin: 0 }}>
          Informe o <strong>total do romaneio</strong> desta visita, inclusive o que veio de complemento na mesma viagem.
        </p>
      )}
      {isComplement && (
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 4, fontSize: 12.5 }}>
          <legend style={{ padding: 0, marginBottom: 4 }}>Quando chegou à escola? (obrigatório)</legend>
          <label>
            <input type="radio" name={`${ids}-trip`} checked={trip === "MESMA_VIAGEM"} onChange={() => setTrip("MESMA_VIAGEM")} /> Na mesma viagem da entrega
            inicial — um romaneio só; a entrega inicial já registra o total
          </label>
          <label>
            <input type="radio" name={`${ids}-trip`} checked={trip === "OUTRA_VIAGEM"} onChange={() => setTrip("OUTRA_VIAGEM")} /> Em outra viagem — nova
            entrega, com romaneio próprio
          </label>
        </fieldset>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={field} htmlFor={`${ids}-p`}>
          {sameTrip ? `Quantidade que veio desta origem (${props.unit})` : `Quantidade entregue (${props.unit})`}
          <input id={`${ids}-p`} className="cell-input" style={input} inputMode="decimal" value={presented} onChange={(e) => setPresented(e.target.value)} placeholder={isComplement ? "" : "0 = nada entregue"} />
        </label>
        {!sameTrip && (
          <label style={field} htmlFor={`${ids}-r`}>
            Rejeitado pela escola ({props.unit})
            <input id={`${ids}-r`} className="cell-input" style={input} inputMode="decimal" value={rejected} onChange={(e) => setRejected(e.target.value)} placeholder="0" />
          </label>
        )}
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
        {!sameTrip && (
          <>
            <label style={field} htmlFor={`${ids}-d`}>
              Data e horário reais da entrega
              <input id={`${ids}-d`} type="datetime-local" className="cell-input" style={{ ...input, maxWidth: 210 }} value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
            </label>
            <label style={field} htmlFor={`${ids}-rb`}>
              Recebido por (romaneio)
              <input id={`${ids}-rb`} className="cell-input" style={{ ...input, maxWidth: 220 }} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {sameTrip && (
        <p className="stat-sub" style={{ margin: 0 }}>
          Rejeição, perda, data/horário e quem recebeu ficam na entrega inicial, que é a linha do romaneio. Este registro guarda a origem para o
          pagamento no galpão e não gera documento próprio.
        </p>
      )}
      {!sameTrip && (
        <label style={{ fontSize: 12.5 }}>
          <input type="checkbox" checked={hasLoss} onChange={(e) => setHasLoss(e.target.checked)} /> Houve perda antes de chegar à escola (transporte/manuseio)
        </label>
      )}
      {hasLoss && !sameTrip && (
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
