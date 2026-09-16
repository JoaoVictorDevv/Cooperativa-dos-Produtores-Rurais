"use client";

import { useMemo, useState } from "react";
import { ProducerRow, } from "./ProducerRow";

type Producer = Parameters<typeof ProducerRow>[0];

export function ProdutoresTable({ rows }: { rows: Producer[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.producerName.toLowerCase().includes(q));
  }, [search, rows]);

  const pendingCount = rows.filter((r) => r.pending).length;

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <input placeholder="Buscar produtor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-chip">{rows.length} produtores</div>
        <div className="filter-chip" style={pendingCount > 0 ? { color: "#8B3A2E", borderColor: "#E9C6BC" } : undefined}>
          {pendingCount} pendentes
        </div>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produtor</th>
              <th style={{ width: 100 }}>Pedido (kg)</th>
              <th style={{ width: 100 }}>Entrega (kg)</th>
              <th style={{ width: 120 }}>Situação</th>
              <th style={{ width: 110 }}>Valor a pagar</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <ProducerRow key={row.producerId} {...row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot-note">Clique numa linha para dividir/pedir/registrar entrega e devolução por produto.</div>
    </>
  );
}
