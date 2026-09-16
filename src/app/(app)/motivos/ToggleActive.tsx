"use client";

import { useTransition } from "react";
import { setReturnReasonActive } from "@/app/actions/returnReasons";

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="link-action"
      disabled={pending}
      onClick={() => startTransition(() => setReturnReasonActive(id, !active))}
    >
      {active ? "Desativar" : "Ativar"}
    </button>
  );
}
