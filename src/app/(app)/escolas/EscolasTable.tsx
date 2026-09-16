"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SchoolOrderCell } from "./SchoolOrderCell";

interface SchoolRow {
  id: string;
  code: string;
  name: string;
  neighborhood: string | null;
}
interface ProductCol {
  id: string;
  name: string;
}

export function EscolasTable({
  weekId,
  schools,
  products,
  orders,
  editable,
}: {
  weekId: string;
  schools: SchoolRow[];
  products: ProductCol[];
  orders: Record<string, number>;
  editable: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [search, schools]);

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <input
            placeholder="Buscar escola por nome ou código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-chip">{schools.length} escolas</div>
        <div className="filter-chip">{filtered.length} exibidas</div>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0, background: "var(--panel)" }}>Código</th>
              <th style={{ position: "sticky", left: 70, background: "var(--panel)" }}>Escola</th>
              {products.map((p) => (
                <th key={p.id} style={{ width: 90 }}>
                  {p.name}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((school) => (
              <tr key={school.id}>
                <td className="code-tag" style={{ position: "sticky", left: 0, background: "var(--panel)" }}>
                  {school.code}
                </td>
                <td className="name-cell" style={{ position: "sticky", left: 70, background: "var(--panel)" }}>
                  {school.name}
                  {school.neighborhood && <span className="sub">{school.neighborhood}</span>}
                </td>
                {products.map((p) => (
                  <td key={p.id}>
                    <SchoolOrderCell
                      weekId={weekId}
                      schoolId={school.id}
                      productId={p.id}
                      initialValue={orders[`${school.id}:${p.id}`] ?? 0}
                      editable={editable}
                    />
                  </td>
                ))}
                <td>
                  <Link className="link-action" href={`/escolas/${school.code}`}>
                    Ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot-note">
        Pedido (kg) por produto. Devolução e motivo ficam na ficha de cada escola.
      </div>
    </>
  );
}
