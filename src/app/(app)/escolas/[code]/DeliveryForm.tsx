"use client";

import { useState, useTransition } from "react";
import { saveSchoolDelivery } from "@/app/actions/schoolDeliveries";

export function DeliveryForm({
  weekId,
  schoolId,
  initialWeekday,
  initialDate,
  editable,
}: {
  weekId: string;
  schoolId: string;
  initialWeekday: string | null;
  initialDate: string | null;
  editable: boolean;
}) {
  const [weekday, setWeekday] = useState(initialWeekday ?? "SEGUNDA");
  const [date, setDate] = useState(initialDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await saveSchoolDelivery(weekId, schoolId, weekday, date);
      if (result.ok) {
        setSaved(true);
        setError(null);
      } else {
        setError(result.error ?? "Erro ao salvar");
      }
    });
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div>
        <label className="login-label" htmlFor="weekday">
          Dia da entrega
        </label>
        <select
          className="login-input"
          style={{ marginBottom: 0 }}
          id="weekday"
          disabled={!editable}
          value={weekday}
          onChange={(e) => setWeekday(e.target.value)}
        >
          <option value="SEGUNDA">Segunda-feira</option>
          <option value="TERCA">Terça-feira</option>
          <option value="EXCEPCIONAL">Data excepcional</option>
        </select>
      </div>
      <div>
        <label className="login-label" htmlFor="deliveredAt">
          Data real
        </label>
        <input
          className="login-input"
          style={{ marginBottom: 0 }}
          type="date"
          id="deliveredAt"
          disabled={!editable}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <button className="btn-ghost" disabled={!editable || pending} onClick={submit}>
        {pending ? "Salvando…" : saved ? "Salvo ✓" : "Registrar entrega"}
      </button>
      {error && <span className="login-error" style={{ margin: 0 }}>{error}</span>}
    </div>
  );
}
