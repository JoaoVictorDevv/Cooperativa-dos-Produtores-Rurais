"use client";

import { useState, useTransition } from "react";
import { saveSchoolOrder } from "@/app/actions/schoolOrders";

export function SchoolOrderCell({
  weekId,
  schoolId,
  productId,
  initialValue,
  editable,
}: {
  weekId: string;
  schoolId: string;
  productId: string;
  initialValue: number;
  editable: boolean;
}) {
  const [value, setValue] = useState(initialValue === 0 ? "" : String(initialValue));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleBlur() {
    if (!editable) return;
    const numeric = value === "" ? 0 : Number(value.replace(",", "."));
    startTransition(async () => {
      const result = await saveSchoolOrder(weekId, schoolId, productId, numeric);
      if (result.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(result.error ?? "Erro ao salvar");
      }
    });
  }

  return (
    <input
      className={`cell-input${status === "error" ? " pending" : ""}${status === "saved" ? " saved" : ""}`}
      value={value}
      disabled={!editable || pending}
      title={error ?? undefined}
      onChange={(e) => {
        setValue(e.target.value);
        setStatus("idle");
      }}
      onBlur={handleBlur}
      inputMode="decimal"
    />
  );
}
