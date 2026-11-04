"use client";

import { useState, useTransition } from "react";
import { saveSchoolReturn } from "@/app/actions/schoolReturns";
import { formatQty } from "@/lib/format";

interface Reason {
  id: string;
  code: number;
  description: string;
}

export function ReturnRow({
  weekId,
  schoolId,
  productId,
  productName,
  productSlug,
  orderedQty,
  initialReturnedQty,
  initialReasonId,
  reasons,
  editable,
}: {
  weekId: string;
  schoolId: string;
  productId: string;
  productName: string;
  productSlug: string;
  orderedQty: number;
  initialReturnedQty: number;
  initialReasonId: string | null;
  reasons: Reason[];
  editable: boolean;
}) {
  const [returnedQty, setReturnedQty] = useState(initialReturnedQty === 0 ? "" : String(initialReturnedQty));
  const [reasonId, setReasonId] = useState(initialReasonId ?? "");
  const [revealed, setRevealed] = useState(initialReturnedQty > 0);
  // Distingue "nada digitado ainda" de "ja existe devolucao gravada" —
  // sem isso, corrigir uma devolucao existente para zero (§4B) fica
  // indistinguivel de um campo em branco e nunca chega a salvar.
  const [hasPersistedReturn, setHasPersistedReturn] = useState(initialReturnedQty > 0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function save(nextQty: string, nextReason: string) {
    if (!editable) return;
    const trimmed = nextQty.trim();
    const numeric = trimmed === "" ? 0 : Number(trimmed.replace(",", "."));
    // Campo vazio e nunca houve devolucao: nao ha nada pra corrigir ou salvar.
    if (numeric === 0 && !hasPersistedReturn) return;
    if (numeric > 0 && !nextReason) {
      setError("Selecione o motivo.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    startTransition(async () => {
      const result = await saveSchoolReturn(weekId, schoolId, productId, numeric, nextReason);
      if (result.ok) {
        setError(null);
        setStatus("saved");
        setHasPersistedReturn(numeric > 0);
        if (numeric === 0) {
          // devolucao corrigida pra zero = lancamento removido; volta pro
          // estado "sem devolucao registrada" (botao de revelar de novo).
          setRevealed(false);
          setReturnedQty("");
          setReasonId("");
        }
      } else {
        setStatus("error");
        setError(result.error ?? "Erro ao salvar");
      }
    });
  }

  const netQty = orderedQty - (Number(returnedQty.replace(",", ".")) || 0);

  return (
    <tr>
      <td>{productName}</td>
      <td className="mono">{formatQty(orderedQty, productSlug)}</td>
      <td>
        {revealed ? (
          <>
            <input
              className={`cell-input${status === "error" ? " pending" : ""}${status === "saved" ? " saved" : ""}`}
              disabled={!editable || pending}
              value={returnedQty}
              title={error ?? undefined}
              autoFocus
              onChange={(e) => {
                setReturnedQty(e.target.value);
                setStatus("idle");
              }}
              onBlur={() => save(returnedQty, reasonId)}
            />
            {status === "saving" && <span className="stat-sub"> salvando…</span>}
            {status === "saved" && <span className="stat-sub"> salvo</span>}
          </>
        ) : (
          <button
            type="button"
            className="link-action"
            style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: editable ? "pointer" : "default" }}
            disabled={!editable}
            onClick={() => setRevealed(true)}
          >
            + Registrar devolução
          </button>
        )}
      </td>
      <td>
        {revealed ? (
          <select
            className="login-input"
            style={{ marginBottom: 0, fontSize: 12, padding: "6px 8px" }}
            disabled={!editable || pending}
            value={reasonId}
            onChange={(e) => {
              setReasonId(e.target.value);
              save(returnedQty, e.target.value);
            }}
          >
            <option value="">—</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.description}
              </option>
            ))}
          </select>
        ) : (
          <span className="stat-sub">—</span>
        )}
      </td>
      <td className="mono">
        <strong>{formatQty(netQty, productSlug)}</strong>
      </td>
    </tr>
  );
}
