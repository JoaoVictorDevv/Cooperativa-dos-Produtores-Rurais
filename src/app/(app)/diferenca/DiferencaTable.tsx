"use client";

import { useMemo, useState } from "react";
import { formatQty } from "@/lib/format";

interface Line {
  productId: string;
  productName: string;
  productSlug: string;
  orderedQty: number;
  deliveredQty: number;
  returnedQty: number;
  netDeliveredQty: number;
  difference: number;
  status: "FALTA" | "SOBRA" | "OK";
}

const STATUS_BADGE: Record<Line["status"], string> = {
  FALTA: "estourado",
  SOBRA: "atencao",
  OK: "ok",
};

const STATUS_LABEL: Record<Line["status"], string> = {
  FALTA: "Falta",
  SOBRA: "Sobra",
  OK: "OK",
};

export function DiferencaTable({ lines }: { lines: Line[] }) {
  const [filter, setFilter] = useState<"TODOS" | Line["status"]>("TODOS");

  const filtered = useMemo(
    () => (filter === "TODOS" ? lines : lines.filter((l) => l.status === filter)),
    [filter, lines],
  );

  const counts = useMemo(() => {
    const c = { FALTA: 0, SOBRA: 0, OK: 0 };
    for (const l of lines) c[l.status]++;
    return c;
  }, [lines]);

  return (
    <>
      <div className="toolbar">
        <button className={`filter-chip${filter === "TODOS" ? " active" : ""}`} onClick={() => setFilter("TODOS")}>
          Todos ({lines.length})
        </button>
        <button className={`filter-chip${filter === "FALTA" ? " active" : ""}`} onClick={() => setFilter("FALTA")}>
          Falta ({counts.FALTA})
        </button>
        <button className={`filter-chip${filter === "SOBRA" ? " active" : ""}`} onClick={() => setFilter("SOBRA")}>
          Sobra ({counts.SOBRA})
        </button>
        <button className={`filter-chip${filter === "OK" ? " active" : ""}`} onClick={() => setFilter("OK")}>
          OK ({counts.OK})
        </button>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Pedido das escolas</th>
              <th>Entrega bruta (produtores)</th>
              <th>Devolução (produtores)</th>
              <th>Entrega líquida</th>
              <th>Diferença</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.productId}>
                <td>{l.productName}</td>
                <td className="mono">{formatQty(l.orderedQty, l.productSlug)}</td>
                <td className="mono">{formatQty(l.deliveredQty, l.productSlug)}</td>
                <td className="mono">{formatQty(l.returnedQty, l.productSlug)}</td>
                <td className="mono">{formatQty(l.netDeliveredQty, l.productSlug)}</td>
                <td className="mono">
                  {l.difference > 0 ? "+" : ""}
                  {formatQty(l.difference, l.productSlug)}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="table-foot-note">
                  {lines.length === 0
                    ? "Nenhum pedido ou entrega lançado nesta semana ainda."
                    : "Nenhum produto nessa situação."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot-note">
        Comparação por produto entre o pedido das escolas e o que o galpão recebeu dos produtores (entrega −
        devolução). Não representa o estoque atual do galpão nem o quanto cada escola recebeu de fato — isso é
        acompanhado nas fichas de escola.
      </div>
    </>
  );
}
