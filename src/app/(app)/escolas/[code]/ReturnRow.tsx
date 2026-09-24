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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(nextQty: string, nextReason: string) {
    if (!editable) return;
    const numeric = nextQty === "" ? 0 : Number(nextQty.replace(",", "."));
    if (numeric === 0) return; // sem devolucao lancada ainda, nao ha o que salvar
    if (!nextReason) {
      setError("Selecione o motivo.");
      return;
    }
    startTransition(async () => {
      const result = await saveSchoolReturn(weekId, schoolId, productId, numeric, nextReason);
      setError(result.ok ? null : result.error ?? "Erro ao salvar");
    });
  }

  const netQty = orderedQty - (Number(returnedQty.replace(",", ".")) || 0);

  return (
    <tr>
      <td>{productName}</td>
      <td className="mono">{formatQty(orderedQty, productSlug)}</td>
      <td>
        {revealed ? (
          <input
            className={`cell-input${error ? " pending" : ""}`}
            disabled={!editable || pending}
            value={returnedQty}
            title={error ?? undefined}
            autoFocus
            onChange={(e) => setReturnedQty(e.target.value)}
            onBlur={() => save(returnedQty, reasonId)}
          />
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
