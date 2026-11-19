"use client";

import { useState } from "react";
import { importarModelo, importarSemanaDaPlanilha } from "../acoes";
import { Aviso, useAcao } from "../ui";

export function ImportarModelo() {
  const { pendente, aviso, setAviso, rodar } = useAcao();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        rodar(
          () => importarModelo(form),
          "Cadastro atualizado.",
          (r) => "resumo" in r && setAviso({ tipo: "ok", texto: `Cadastro atualizado: ${r.resumo}` }),
        );
      }}
    >
      <div className="botoes">
        <input type="file" name="arquivo" accept=".xlsx" required />
        <button className="botao" disabled={pendente}>
          {pendente ? "Lendo a planilha…" : "Trazer MODELO"}
        </button>
      </div>
      <Aviso aviso={aviso} />
    </form>
  );
}

export function ImportarSemana() {
  const { pendente, aviso, setAviso, rodar } = useAcao();
  const [substituir, setSubstituir] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        if (substituir) form.set("substituir", "sim");
        rodar(
          () => importarSemanaDaPlanilha(form),
          "Semana trazida.",
          (r) => "data" in r && setAviso({ tipo: "ok", texto: `Semana ${r.data.split("-").reverse().join("/")} trazida para o app.` }),
        );
      }}
    >
      <div className="botoes">
        <input type="file" name="arquivo" accept=".xlsx" required />
        <label className="discreto">
          <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> substituir se já existir
        </label>
        <button className="botao claro" disabled={pendente}>
          {pendente ? "Lendo…" : "Trazer semana"}
        </button>
      </div>
      <Aviso aviso={aviso} />
    </form>
  );
}
