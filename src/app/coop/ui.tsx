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

// Aviso de "você não salvou": qualquer campo digitado dentro do app marca
// "sujo"; salvar com sucesso limpa. Busca e filtros têm data-livre (não contam).
let sujo = false;
export function temNaoSalvo() {
  return sujo;
}
export function marcarSujo(v: boolean) {
  sujo = v;
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
          sujo = false;
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

export function BotaoImprimir({ texto = "Imprimir / salvar PDF", imagem = true }: { texto?: string; imagem?: boolean }) {
  return (
    <>
      <button type="button" className="botao claro nao-imprimir" onClick={() => window.print()}>
        🖨 {texto}
      </button>
      {imagem && <BotaoImagem />}
    </>
  );
}

const nomeArquivo = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "folha";

// Salva cada folha da tela como imagem (PNG), do jeito que sai na impressão, para mandar no WhatsApp.
export function BotaoImagem() {
  const [estado, setEstado] = useState<"" | "fazendo" | "ok" | "erro">("");
  async function salvar() {
    setEstado("fazendo");
    try {
      const { toPng } = await import("html-to-image");
      const folhas = [...document.querySelectorAll<HTMLElement>(".coop-main .folha")].filter((f) => f.offsetParent !== null);
      for (const [i, f] of folhas.entries()) {
        const titulo = f.dataset.arquivo ?? f.querySelector("h3")?.textContent ?? document.title;
        // A logo da folha é um fundo (::before), que não sai na imagem: põe uma <img> no lugar enquanto tira a foto.
        const logo = document.createElement("img");
        logo.src = "/coop/logo.jpg";
        logo.alt = "";
        Object.assign(logo.style, { position: "absolute", left: "18px", top: "16px", width: "54px", height: "54px", borderRadius: "50%", objectFit: "cover" });
        f.appendChild(logo);
        await logo.decode().catch(() => undefined);
        let url: string;
        try {
          url = await toPng(f, {
            pixelRatio: 2,
            backgroundColor: "#ffffff",
            cacheBust: true,
            filter: (n) => !(n instanceof HTMLElement && n.classList.contains("nao-imprimir")),
          });
        } finally {
          logo.remove();
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomeArquivo(titulo)}${folhas.length > 1 ? `-${i + 1}` : ""}.png`;
        a.click();
        if (folhas.length > 1) await new Promise((r) => setTimeout(r, 400));
      }
      setEstado(folhas.length ? "ok" : "erro");
    } catch {
      setEstado("erro");
    }
    setTimeout(() => setEstado(""), 3000);
  }
  return (
    <button type="button" className="botao claro nao-imprimir" onClick={salvar} disabled={estado === "fazendo"} title="Baixa a folha como imagem (PNG) para mandar no WhatsApp">
      {estado === "fazendo" ? "Gerando…" : estado === "ok" ? "✓ Imagem salva (Downloads)" : estado === "erro" ? "Não deu, tente de novo" : "🖼 Salvar imagem"}
    </button>
  );
}
