"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Número como o João digita: "19,3", "19.3", "1.200,5". Vazio = null.
export function lerNumero(t: string): number | null {
  const s = t.trim().replace(/\s/g, "");
  if (!s) return null;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const v = Number(normal);
  return Number.isFinite(v) && v >= 0 ? v : NaN;
}

export function mostrarNumero(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Math.round(v * 1000) / 1000).replace(".", ",");
}

type Resultado = { ok: true } | { ok: false; erro: string };

// Roda uma ação do servidor, mostra "Salvo" ou o erro, e atualiza a tela.
export function useAcao() {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const router = useRouter();
  function rodar<T extends Resultado>(fn: () => Promise<T>, okTexto = "Salvo.", depois?: (r: T) => void) {
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          setAviso({ tipo: "ok", texto: okTexto });
          depois?.(r);
          router.refresh();
        } else setAviso({ tipo: "erro", texto: r.erro });
      } catch {
        setAviso({ tipo: "erro", texto: "Não deu certo. Tente de novo." });
      }
    });
  }
  return { pendente, aviso, setAviso, rodar };
}

export function Aviso({ aviso }: { aviso: { tipo: "ok" | "erro"; texto: string } | null }) {
  if (!aviso) return null;
  return (
    <div className={aviso.tipo} role={aviso.tipo === "erro" ? "alert" : "status"}>
      {aviso.texto}
    </div>
  );
}

export function CampoNumero({
  valor,
  aoMudar,
  placeholder,
  rotulo,
  largura,
}: {
  valor: string;
  aoMudar: (t: string) => void;
  placeholder?: string;
  rotulo: string;
  largura?: number;
}) {
  const v = lerNumero(valor);
  return (
    <input
      type="text"
      inputMode="decimal"
      className="digita"
      aria-label={rotulo}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
      style={{ width: largura, borderColor: Number.isNaN(v) ? "var(--c-vermelho)" : undefined }}
    />
  );
}

export function BotaoImprimir({ texto = "Imprimir / salvar PDF" }: { texto?: string }) {
  return (
    <button type="button" className="botao claro nao-imprimir" onClick={() => window.print()}>
      🖨 {texto}
    </button>
  );
}
