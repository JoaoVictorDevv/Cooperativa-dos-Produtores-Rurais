"use client";

import { useState, useTransition } from "react";
import { saveSchoolReturn } from "@/app/actions/schoolReturns";

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
  orderedQty: number;
  initialReturnedQty: number;
  initialReasonId: string | null;
  reasons: Reason[];
  editable: boolean;
}) {
  const [returnedQty, setReturnedQty] = useState(initialReturnedQty === 0 ? "" : String(initialReturnedQty));
  const [reasonId, setReasonId] = useState(initialReasonId ?? "");
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
      <td className="mono">{orderedQty.toFixed(2)}</td>
      <td>
        <input
          className={`cell-input${error ? " pending" : ""}`}
          disabled={!editable || pending}
          value={returnedQty}
          title={error ?? undefined}
          onChange={(e) => setReturnedQty(e.target.value)}
          onBlur={() => save(returnedQty, reasonId)}
        />
      </td>
      <td>
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
      </td>
      <td className="mono">
        <strong>{netQty.toFixed(2)}</strong>
      </td>
    </tr>
  );
}
