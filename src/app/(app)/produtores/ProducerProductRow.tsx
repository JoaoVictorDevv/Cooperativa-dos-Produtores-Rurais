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
  const [ordered, setOrdered] = useState(initial.orderedQty === 0 ? "" : String(initial.orderedQty));
  const [delivered, setDelivered] = useState(initial.deliveredQty ? String(initial.deliveredQty) : "");
  const [deliveredAt, setDeliveredAt] = useState(initial.deliveredAt ?? "");
  const [returned, setReturned] = useState(initial.returnedQty === 0 ? "" : String(initial.returnedQty));
  const [reasonId, setReasonId] = useState(initial.returnReasonId ?? "");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [, startTransition] = useTransition();

  const num = (v: string) => (v === "" ? 0 : Number(v.replace(",", ".")));

  function saveAllocation() {
    if (!editable) return;
    startTransition(async () => {
      const r = await saveProducerAllocation(weekId, productId, producerId, num(allocated));
      setErrors((e) => ({ ...e, allocation: r.ok ? null : r.error ?? "erro" }));
    });
  }
  function saveOrder() {
    if (!editable) return;
    startTransition(async () => {
      const r = await saveProducerOrder(weekId, producerId, productId, num(ordered));
      setErrors((e) => ({ ...e, order: r.ok ? null : r.error ?? "erro" }));
    });
  }
  function saveDelivery(nextDelivered: string, nextDate: string) {
    if (!editable || !nextDate || num(nextDelivered) === 0) return;
    startTransition(async () => {
      const r = await saveProducerDelivery(weekId, producerId, productId, num(nextDelivered), nextDate);
      setErrors((e) => ({ ...e, delivery: r.ok ? null : r.error ?? "erro" }));
    });
  }
  function saveReturn(nextReturned: string, nextReason: string) {
    if (!editable || num(nextReturned) === 0) return;
    if (!nextReason) {
      setErrors((e) => ({ ...e, return: "Selecione o motivo" }));
      return;
    }
    startTransition(async () => {
      const r = await saveProducerReturn(weekId, producerId, productId, num(nextReturned), nextReason);
      setErrors((e) => ({ ...e, return: r.ok ? null : r.error ?? "erro" }));
    });
  }

  const netQty = Math.max(num(delivered) - num(returned), 0);
  const value = Math.round(netQty * (initial.price - initial.logisticsDeductionPerKg) * 100) / 100;

  return (
    <tr>
      <td>{productName}</td>
      <td>
        <input
          className="cell-input"
          disabled={!editable}
          value={allocated}
          title={errors.allocation ?? undefined}
          onChange={(e) => setAllocated(e.target.value)}
          onBlur={saveAllocation}
        />
      </td>
      <td>
        <input
          className="cell-input"
          disabled={!editable}
          value={ordered}
          title={errors.order ?? undefined}
          onChange={(e) => setOrdered(e.target.value)}
          onBlur={saveOrder}
        />
      </td>
      <td>
        <input
          className="cell-input"
          disabled={!editable}
          value={delivered}
          title={errors.delivery ?? undefined}
          onChange={(e) => setDelivered(e.target.value)}
          onBlur={() => saveDelivery(delivered, deliveredAt)}
        />
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
        <input
          className={`cell-input${errors.return ? " pending" : ""}`}
          disabled={!editable}
          value={returned}
          title={errors.return ?? undefined}
          onChange={(e) => setReturned(e.target.value)}
          onBlur={() => saveReturn(returned, reasonId)}
        />
      </td>
      <td>
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
      </td>
      <td className="mono">
        <strong>{value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) : "—"}</strong>
      </td>
    </tr>
  );
}
