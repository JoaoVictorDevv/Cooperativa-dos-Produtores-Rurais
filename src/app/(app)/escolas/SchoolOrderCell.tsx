"use client";

import { useState, useTransition } from "react";
import { saveSchoolOrder } from "@/app/actions/schoolOrders";

function toText(value: number) {
  return value === 0 ? "" : String(value);
}

function parse(text: string) {
  return text.trim() === "" ? 0 : Number(text.replace(",", "."));
}

// Sem edição em andamento, mostra sempre o valor atual do servidor (inclusive
// depois de uma importação ou troca de ciclo). Uma edição local nunca é
// sobrescrita pela atualização; se o valor do servidor mudar enquanto se
// edita, a gravação é interrompida e o conflito aparece no campo.
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
  const [draft, setDraft] = useState<string | null>(null);
  const [baseAtEdit, setBaseAtEdit] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const savedAndSynced = draft !== null && status === "saved" && parse(draft) === initialValue;
  const editing = draft !== null && !savedAndSynced;
  const shown = editing ? draft : toText(initialValue);

  function handleBlur() {
    if (!editable || !editing || draft === null) return;
    const numeric = parse(draft);
    if (Number.isNaN(numeric)) {
      setStatus("error");
      setError("Valor inválido.");
      return;
    }
    if (baseAtEdit !== null && baseAtEdit !== initialValue) {
      setStatus("error");
      setError(`Este pedido mudou para ${initialValue} enquanto você editava (importação ou outra pessoa). Confira e saia do campo de novo para gravar ${numeric}.`);
      setBaseAtEdit(initialValue);
      return;
    }
    if (numeric === initialValue) {
      setDraft(null);
      setStatus("idle");
      return;
    }
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

  const title = error ?? (pending ? "Salvando…" : editing ? "Alteração ainda não gravada — saia do campo para salvar" : status === "saved" ? "Salvo" : undefined);

  return (
    <input
      className={`cell-input${status === "error" ? " pending" : ""}${status === "saved" && !editing ? " saved" : ""}`}
      value={shown}
      disabled={!editable || pending}
      title={title}
      aria-invalid={status === "error" || undefined}
      onChange={(e) => {
        if (draft === null) setBaseAtEdit(initialValue);
        setDraft(e.target.value);
        setStatus("idle");
        setError(null);
      }}
      onBlur={handleBlur}
      inputMode="decimal"
    />
  );
}
