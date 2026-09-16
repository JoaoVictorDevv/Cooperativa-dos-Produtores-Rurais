"use client";

import { useState, useTransition } from "react";
import { saveWeeklyCost } from "@/app/actions/weeklyCosts";
import type { CostCategory } from "@prisma/client";

export function CostCell({
  weekId,
  category,
  initialValue,
  editable,
}: {
  weekId: string;
  category: CostCategory;
  initialValue: number;
  editable: boolean;
}) {
  const [value, setValue] = useState(initialValue === 0 ? "" : String(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!editable) return;
    const numeric = value === "" ? 0 : Number(value.replace(",", "."));
    startTransition(async () => {
      const result = await saveWeeklyCost(weekId, category, numeric);
      setError(result.ok ? null : result.error ?? "Erro ao salvar");
    });
  }

  return (
    <input
      value={value}
      disabled={!editable || pending}
      title={error ?? undefined}
      style={error ? { borderColor: "var(--brick)" } : undefined}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
    />
  );
}
