"use client";

import { useState, useTransition } from "react";
import { saveProducerAllocation } from "@/app/actions/producerAllocations";
import { saveProducerOrder } from "@/app/actions/producerOrders";
import { saveProducerDelivery } from "@/app/actions/producerDeliveries";
import { saveProducerReturn } from "@/app/actions/producerReturns";

interface Reason {
  id: string;
  code: number;
  description: string;
}

export function ProducerProductRow({
  weekId,
  producerId,
  productId,
  productName,
  editable,
  reasons,
  initial,
}: {
  weekId: string;
  producerId: string;
  productId: string;
  productName: string;
  editable: boolean;
  reasons: Reason[];
  initial: {
    allocatedQty: number;
    orderedQty: number;
    deliveredQty: number | null;
    deliveredAt: string | null;
    returnedQty: number;
    returnReasonId: string | null;
    price: number;
    logisticsDeductionPerKg: number;
  };
}) {
  const [allocated, setAllocated] = useState(initial.allocatedQty === 0 ? "" : String(initial.allocatedQty));
  // Pedido: sem edição em andamento, mostra o valor atual do servidor (ex.:
  // depois de gerar pedidos a partir da divisão).
  const [orderDraft, setOrderDraft] = useState<string | null>(null);
  const ordered = orderDraft ?? (initial.orderedQty === 0 ? "" : String(initial.orderedQty));
  const [delivered, setDelivered] = useState(initial.deliveredQty !== null ? String(initial.deliveredQty) : "");
  const [deliveredAt, setDeliveredAt] = useState(initial.deliveredAt ?? "");
  const [returned, setReturned] = useState(initial.returnedQty === 0 ? "" : String(initial.returnedQty));
  const [reasonId, setReasonId] = useState(initial.returnReasonId ?? "");
  const [returnRevealed, setReturnRevealed] = useState(initial.returnedQty > 0);
  // Distingue "ja existe devolucao gravada" de "campo em branco" — sem
  // isso, corrigir uma devolucao existente pra zero (§4B) fica
  // indistinguivel de um campo nunca preenchido e nunca chega a salvar.
  const [hasPersistedReturn, setHasPersistedReturn] = useState(initial.returnedQty > 0);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [, startTransition] = useTransition();

  const num = (v: string) => (v === "" ? 0 : Number(v.replace(",", ".")));

  function saveAllocation() {
    if (!editable) return;
    setStatus((s) => ({ ...s, allocation: "saving" }));
    startTransition(async () => {
      const r = await saveProducerAllocation(weekId, productId, producerId, num(allocated));
      setErrors((e) => ({ ...e, allocation: r.ok ? null : r.error ?? "erro" }));
      setStatus((s) => ({ ...s, allocation: r.ok ? "saved" : "error" }));
    });
  }
  function saveOrder() {
    if (!editable || orderDraft === null) return;
    if (num(orderDraft) === initial.orderedQty) {
      setOrderDraft(null);
      return;
    }
    setStatus((s) => ({ ...s, order: "saving" }));
    startTransition(async () => {
      const r = await saveProducerOrder(weekId, producerId, productId, num(orderDraft));
      setErrors((e) => ({ ...e, order: r.ok ? null : r.error ?? "erro" }));
      setStatus((s) => ({ ...s, order: r.ok ? "saved" : "error" }));
      if (r.ok) setOrderDraft(null);
    });
  }
  function saveDelivery(nextDelivered: string, nextDate: string) {
    if (!editable || !nextDate) return;
    // Campo de quantidade em branco = entrega ainda nao conferida, nada a
    // salvar. "0" explicito e uma entrega zero CONFIRMADA e deve salvar.
    if (nextDelivered.trim() === "") return;
    setStatus((s) => ({ ...s, delivery: "saving" }));
    startTransition(async () => {
      const r = await saveProducerDelivery(weekId, producerId, productId, num(nextDelivered), nextDate);
      setErrors((e) => ({ ...e, delivery: r.ok ? null : r.error ?? "erro" }));
      setStatus((s) => ({ ...s, delivery: r.ok ? "saved" : "error" }));
    });
  }
  function saveReturn(nextReturned: string, nextReason: string) {
    if (!editable) return;
    const numeric = num(nextReturned);
    if (numeric === 0 && !hasPersistedReturn) return; // nada digitado, nada a corrigir
    if (numeric > 0 && !nextReason) {
      setErrors((e) => ({ ...e, return: "Selecione o motivo" }));
      setStatus((s) => ({ ...s, return: "error" }));
      return;
    }
    setStatus((s) => ({ ...s, return: "saving" }));
    startTransition(async () => {
      const r = await saveProducerReturn(weekId, producerId, productId, numeric, nextReason);
      setErrors((e) => ({ ...e, return: r.ok ? null : r.error ?? "erro" }));
      setStatus((s) => ({ ...s, return: r.ok ? "saved" : "error" }));
      if (r.ok) {
        setHasPersistedReturn(numeric > 0);
        if (numeric === 0) {
          // devolucao corrigida pra zero = lancamento removido.
          setReturnRevealed(false);
          setReturned("");
          setReasonId("");
        }
      }
    });
  }

  const netQty = Math.max(num(delivered) - num(returned), 0);
  const value = Math.round(netQty * (initial.price - initial.logisticsDeductionPerKg) * 100) / 100;

  function cellClass(field: string) {
    if (status[field] === "error") return " pending";
    if (status[field] === "saved") return " saved";
    return "";
  }
  function statusHint(field: string) {
    if (status[field] === "saving") return <span className="stat-sub"> salvando…</span>;
    if (status[field] === "saved") return <span className="stat-sub"> salvo</span>;
    return null;
  }

  return (
    <tr>
      <td>{productName}</td>
      <td>
        <input
          className={`cell-input${cellClass("allocation")}`}
          disabled={!editable}
          value={allocated}
          title={errors.allocation ?? undefined}
          onChange={(e) => {
            setAllocated(e.target.value);
            setStatus((s) => ({ ...s, allocation: "idle" }));
          }}
          onBlur={saveAllocation}
        />
        {statusHint("allocation")}
        {status.allocation !== "saving" && status.allocation !== "saved" && initial.allocatedQty > 0 && (
          <span className="stat-sub" style={{ display: "block" }}>
            {initial.orderedQty === 0 ? "só planejado" : initial.orderedQty === initial.allocatedQty ? "pedido emitido" : "pedido ≠ divisão"}
          </span>
        )}
      </td>
      <td>
        <input
          className={`cell-input${cellClass("order")}`}
          disabled={!editable}
          value={ordered}
          title={errors.order ?? undefined}
          onChange={(e) => {
            setOrderDraft(e.target.value);
            setStatus((s) => ({ ...s, order: "idle" }));
          }}
          onBlur={saveOrder}
        />
        {statusHint("order")}
      </td>
      <td>
        <input
          className={`cell-input${cellClass("delivery")}`}
          disabled={!editable}
          value={delivered}
          title={errors.delivery ?? undefined}
          onChange={(e) => {
            setDelivered(e.target.value);
            setStatus((s) => ({ ...s, delivery: "idle" }));
          }}
          onBlur={() => saveDelivery(delivered, deliveredAt)}
        />
        {statusHint("delivery")}
      </td>
      <td>
        <input
          type="date"
          className="cell-input"
          style={{ width: 120 }}
          disabled={!editable}
          value={deliveredAt}
          onChange={(e) => {
            setDeliveredAt(e.target.value);
          }}
          onBlur={() => saveDelivery(delivered, deliveredAt)}
        />
      </td>
      <td>
        {returnRevealed ? (
          <>
            <input
              className={`cell-input${cellClass("return")}`}
              disabled={!editable}
              value={returned}
              title={errors.return ?? undefined}
              autoFocus
              onChange={(e) => {
                setReturned(e.target.value);
                setStatus((s) => ({ ...s, return: "idle" }));
              }}
              onBlur={() => saveReturn(returned, reasonId)}
            />
            {statusHint("return")}
          </>
        ) : (
          <button
            type="button"
            className="link-action"
            style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: editable ? "pointer" : "default" }}
            disabled={!editable}
            onClick={() => setReturnRevealed(true)}
          >
            + Registrar devolução
          </button>
        )}
      </td>
      <td>
        {returnRevealed ? (
          <select
            className="login-input"
            style={{ marginBottom: 0, fontSize: 12, padding: "6px 8px", width: 140 }}
            disabled={!editable}
            value={reasonId}
            onChange={(e) => {
              setReasonId(e.target.value);
              saveReturn(returned, e.target.value);
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
        <strong>{value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) : "—"}</strong>
      </td>
    </tr>
  );
}
