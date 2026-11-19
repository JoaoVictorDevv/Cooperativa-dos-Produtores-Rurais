"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { marcarSujo, temNaoSalvo } from "./ui";

const PERGUNTA = "Você digitou algo e não salvou. Sair mesmo assim? (o que não foi salvo se perde)";

// Avisa antes de sair da tela quando tem coisa digitada e não salva.
export function VigiaNaoSalvo() {
  const caminho = usePathname();
  useEffect(() => marcarSujo(false), [caminho]);
  useEffect(() => {
    const digitou = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || !el.closest(".coop-main") || el.closest("[data-livre]")) return;
      if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "search")) return;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) marcarSujo(true);
    };
    const clicou = (e: MouseEvent) => {
      if (!temNaoSalvo() || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const destino = new URL(a.href, location.href);
      if (destino.origin !== location.origin) return;
      if (destino.pathname === location.pathname && destino.search === location.search) return; // mesma tela (ex.: #âncora)
      if (!window.confirm(PERGUNTA)) {
        e.preventDefault();
        e.stopPropagation();
      } else marcarSujo(false);
    };
    const fechando = (e: BeforeUnloadEvent) => {
      if (!temNaoSalvo()) return;
      e.preventDefault();
      e.returnValue = PERGUNTA;
    };
    document.addEventListener("input", digitou, true);
    document.addEventListener("change", digitou, true);
    document.addEventListener("click", clicou, true);
    window.addEventListener("beforeunload", fechando);
    return () => {
      document.removeEventListener("input", digitou, true);
      document.removeEventListener("change", digitou, true);
      document.removeEventListener("click", clicou, true);
      window.removeEventListener("beforeunload", fechando);
    };
  }, []);
  return null;
}
