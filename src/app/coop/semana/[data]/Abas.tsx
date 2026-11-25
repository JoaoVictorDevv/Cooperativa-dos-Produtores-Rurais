"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// Feito = a etapa está terminada (aparece o ✓ na aba).
export interface FeitoAbas {
  resumo: boolean;
  pedido: boolean;
  galpao1: boolean;
  galpao2: boolean;
  mapa: boolean;
  retornos: boolean;
  fechamento: boolean;
}

// Na impressão, a aba de onde veio continua marcada.
function abaDaImpressao(caminho: string, dia: string | null): string | null {
  const tipo = caminho.split("/imprimir/")[1];
  if (!tipo) return null;
  if (tipo === "produtores") return dia === "2" ? "/galpao/2" : "/galpao/1";
  if (tipo === "mapa" || tipo === "escolas" || tipo === "dia") return "/mapa";
  if (tipo === "paulo" || tipo === "extratos") return "/fechamento";
  return null;
}

function listaAbas(base: string, dias: [string, string], feito: FeitoAbas): [string, string, boolean][] {
  return [
    [base, "Resumo", feito.resumo],
    [`${base}/pedido`, "1. Pedido e Mensagens", feito.pedido],
    [`${base}/galpao/1`, `2. Galpão ${dias[0].toLowerCase()}`, feito.galpao1],
    [`${base}/galpao/2`, `3. Galpão ${dias[1].toLowerCase()}`, feito.galpao2],
    [`${base}/mapa`, "4. Mapa e Romaneios", feito.mapa],
    [`${base}/retornos`, "5. Retornos das Escolas", feito.retornos],
    [`${base}/fechamento`, "6. Fechamento", feito.fechamento],
    [`${base}/perdas`, "Perdas", false],
  ];
}

// No fim de cada etapa: botão para a próxima (não aparece na impressão).
export function ProximaAba({ data, dias, feito }: { data: string; dias: [string, string]; feito: FeitoAbas }) {
  const atual = usePathname();
  const base = `/coop/semana/${data}`;
  if (atual.includes("/imprimir/")) return null;
  const abas = listaAbas(base, dias, feito).slice(1, 7); // etapas 1 a 6
  const i = abas.findIndex(([href]) => atual.startsWith(href));
  const anterior = i > 0 ? abas[i - 1] : atual === base ? null : i === 0 ? ([base, "Resumo", false] as const) : null;
  const proxima = i >= 0 && i < abas.length - 1 ? abas[i + 1] : atual === base ? abas[0] : null;
  if (!anterior && !proxima) return null;
  return (
    <nav className="proxima nao-imprimir">
      {anterior ? (
        <Link className="botao claro" href={anterior[0]}>
          ‹ {anterior[1]}
        </Link>
      ) : (
        <span />
      )}
      {proxima && (
        <Link className="botao" href={proxima[0]}>
          Próxima: {proxima[1]} ›
        </Link>
      )}
    </nav>
  );
}

export function Abas({ data, dias, feito }: { data: string; dias: [string, string]; feito: FeitoAbas }) {
  const atual = usePathname();
  const q = useSearchParams();
  const base = `/coop/semana/${data}`;
  const daImpressao = abaDaImpressao(atual, q.get("dia"));
  const abas = listaAbas(base, dias, feito);
  const nav = useRef<HTMLElement>(null);
  // No celular as abas deslizam: mostra a aba aberta.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>("a.ativa")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [atual]);
  const ativa = (href: string) =>
    daImpressao ? href === base + daImpressao : atual === href || (href !== base && atual.startsWith(href));
  return (
    <nav className="abas nao-imprimir" ref={nav}>
      {abas.map(([href, texto, ok]) => (
        <Link key={href} href={href} className={[ativa(href) ? "ativa" : "", ok ? "feita" : ""].join(" ").trim() || undefined} title={ok ? "Etapa terminada" : undefined}>
          {ok && <span className="check">✓</span>}
          {texto}
        </Link>
      ))}
    </nav>
  );
}
