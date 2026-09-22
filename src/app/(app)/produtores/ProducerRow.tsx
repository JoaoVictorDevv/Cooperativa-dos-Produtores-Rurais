"use client";

import { useState } from "react";
import Link from "next/link";
import { ProducerProductRow } from "./ProducerProductRow";
import { formatQtyNumber } from "@/lib/format";

interface Reason {
  id: string;
  code: number;
  description: string;
}
interface ProductLine {
  productId: string;
  productName: string;
  productSlug: string;
  allocatedQty: number;
  orderedQty: number;
  deliveredQty: number | null;
  deliveredAt: string | null;
  returnedQty: number;
  returnReasonId: string | null;
  price: number;
  logisticsDeductionPerKg: number;
}

export function ProducerRow({
  weekId,
  producerId,
  producerName,
  producerInternalId,
  editable,
  reasons,
  initialLines,
  allProducts,
  pending,
  totalOrdered,
  totalDelivered,
  totalPayment,
}: {
  weekId: string;
  producerId: string;
  producerName: string;
  producerInternalId: string;
  editable: boolean;
  reasons: Reason[];
  initialLines: ProductLine[];
  allProducts: { id: string; name: string; slug: string; price: number; logisticsDeductionPerKg: number }[];
  pending: boolean;
  totalOrdered: number;
  totalDelivered: number;
  totalPayment: number;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(initialLines);
  const [addingProductId, setAddingProductId] = useState("");

  const availableToAdd = allProducts.filter((p) => !lines.some((l) => l.productId === p.id));

  function addProduct() {
    const product = allProducts.find((p) => p.id === addingProductId);
    if (!product) return;
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        allocatedQty: 0,
        orderedQty: 0,
        deliveredQty: null,
        deliveredAt: null,
        returnedQty: 0,
        returnReasonId: null,
        price: product.price,
        logisticsDeductionPerKg: product.logisticsDeductionPerKg,
      },
    ]);
    setAddingProductId("");
  }

  return (
    <>
      <tr className="row-click" onClick={() => setOpen((v) => !v)}>
        <td className="name-cell">
          {producerName}
          <span className="sub">{producerInternalId}</span>
        </td>
        <td className="mono">{formatQtyNumber(totalOrdered)}</td>
        <td className="mono">{formatQtyNumber(totalDelivered)}</td>
        <td>
          <span className={`status-dot ${pending ? "pending" : "ok"}`}>
            <span className="dot" />
            {pending ? "Pendente" : "OK"}
          </span>
        </td>
        <td className="mono">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPayment)}</td>
        <td>
          <Link className="link-action" href={`/produtores/${producerInternalId}`} onClick={(e) => e.stopPropagation()}>
            Ficha
          </Link>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: "var(--bg)" }}>
            <div style={{ padding: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ width: 80 }}>Divisão</th>
                    <th style={{ width: 80 }}>Pedido</th>
                    <th style={{ width: 80 }}>Entrega</th>
                    <th style={{ width: 130 }}>Data entrega</th>
                    <th style={{ width: 80 }}>Devolução</th>
                    <th style={{ width: 150 }}>Motivo</th>
                    <th style={{ width: 100 }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <ProducerProductRow
                      key={line.productId}
                      weekId={weekId}
                      producerId={producerId}
                      productId={line.productId}
                      productName={line.productName}
                      editable={editable}
                      reasons={reasons}
                      initial={line}
                    />
                  ))}
                </tbody>
              </table>
              {editable && availableToAdd.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <select
                    className="login-input"
                    style={{ marginBottom: 0, fontSize: 12, padding: "6px 8px" }}
                    value={addingProductId}
                    onChange={(e) => setAddingProductId(e.target.value)}
                  >
                    <option value="">+ adicionar produto fora do plano…</option>
                    {availableToAdd.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn-tiny" onClick={addProduct} disabled={!addingProductId}>
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
