"use client";

import { useState } from "react";
import { marcarPagamentos } from "../../../acoes";
import { Aviso, useAcao } from "../../../ui";

const br = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

// ✓ "paguei" de um produtor nesta semana (muda na hora; o servidor confirma).
export function PagoCheck({ data, id, pagoEm }: { data: string; id: string; pagoEm: string | null }) {
  const { pendente, rodar } = useAcao();
  const [local, setLocal] = useState<{ de: string | null; v: boolean }>({ de: pagoEm, v: Boolean(pagoEm) });
  const marcado = local.de === pagoEm ? local.v : Boolean(pagoEm);
  return (
    <label className="pago-check" title={marcado ? "Desmarcar" : "Marcar como pago"}>
      <input
        data-livre
        type="checkbox"
        checked={marcado}
        disabled={pendente}
        onChange={(e) => {
          const v = e.target.checked;
          setLocal({ de: pagoEm, v });
          rodar(() => marcarPagamentos(data, [id], v), v ? "Marcado como pago." : "Desmarcado.");
        }}
      />
      {marcado ? <span className="etiqueta verde">pago{pagoEm ? ` ${br(pagoEm)}` : ""}</span> : <span className="etiqueta amarela">falta pagar</span>}
    </label>
  );
}

export function PagarTodos({ data, ids, pagos }: { data: string; ids: string[]; pagos: number }) {
  const { pendente, aviso, rodar } = useAcao();
  const todos = ids.length > 0 && pagos === ids.length;
  return (
    <span className="botoes">
      <strong style={{ color: todos ? "var(--c-verde)" : undefined }}>
        {pagos} de {ids.length} pagos
      </strong>
      {todos ? (
        <button type="button" className="botao pequeno claro" disabled={pendente} onClick={() => rodar(() => marcarPagamentos(data, ids, false), "Desmarcados.")}>
          desmarcar todos
        </button>
      ) : (
        <button type="button" className="botao" disabled={pendente || !ids.length} onClick={() => rodar(() => marcarPagamentos(data, ids, true), "Pronto: todos marcados como pagos.")}>
          ✓ Paguei todos
        </button>
      )}
      <Aviso aviso={aviso} />
    </span>
  );
}
