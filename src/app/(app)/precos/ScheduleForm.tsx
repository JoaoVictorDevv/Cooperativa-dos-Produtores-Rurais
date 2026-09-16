"use client";

import { useActionState } from "react";
import { schedulePriceChange, type PriceFormState } from "@/app/actions/prices";

const initialState: PriceFormState = {};

export function ScheduleForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(schedulePriceChange, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 20, marginBottom: 26 }}>
      <div className="panel-title" style={{ padding: 0, marginBottom: 14 }}>
        Agendar troca de preço
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 220 }}>
          <label className="login-label" htmlFor="productId">
            Produto
          </label>
          <select className="login-input" style={{ marginBottom: 0 }} id="productId" name="productId" required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="login-label" htmlFor="price">
            Novo preço (R$/kg)
          </label>
          <input
            className="login-input"
            style={{ marginBottom: 0, width: 130 }}
            type="number"
            step="0.01"
            min="0.01"
            id="price"
            name="price"
            required
          />
        </div>
        <div>
          <label className="login-label" htmlFor="validFrom">
            Vigente a partir de
          </label>
          <input className="login-input" style={{ marginBottom: 0 }} type="date" id="validFrom" name="validFrom" required />
        </div>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Agendar"}
        </button>
      </div>
      {state.error && <p className="login-error" style={{ marginTop: 12 }}>{state.error}</p>}
    </form>
  );
}
