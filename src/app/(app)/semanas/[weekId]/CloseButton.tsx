"use client";

import { useState, useTransition } from "react";
import { closeWeek } from "@/app/actions/weeks";

export function CloseButton({ weekId }: { weekId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="close-week-action">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await closeWeek(weekId);
            if (!result.ok) setError(result.error ?? "Nao foi possivel fechar a semana.");
          })
        }
      >
        {pending ? "Fechando…" : "Fechar semana"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
