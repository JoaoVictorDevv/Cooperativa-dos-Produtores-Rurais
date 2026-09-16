"use client";

import { useTransition } from "react";
import { closeWeek } from "@/app/actions/weeks";

export function CloseButton({ weekId }: { weekId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() => startTransition(() => closeWeek(weekId))}
    >
      {pending ? "Fechando…" : "Fechar semana"}
    </button>
  );
}
