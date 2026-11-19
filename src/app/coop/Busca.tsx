"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { semAcento } from "@/lib/coop/texto";

export interface ItemBusca {
  tipo: "Escola" | "Produtor" | "Semana";
  titulo: string;
  detalhe?: string;
  href: string;
  chave: string; // texto onde procura (sem acento, minúsculo)
}


// Caixinha do topo: digita "1045", "Gabriel" ou "16/11" e vai direto.
export function Busca({ itens }: { itens: ItemBusca[] }) {
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const achados = useMemo(() => {
    const t = semAcento(texto.trim());
    if (!t) return [];
    const partes = t.split(/\s+/);
    return itens
      .filter((i) => partes.every((p) => i.chave.includes(p)))
      .sort((a, b) => Number(!a.chave.startsWith(partes[0])) - Number(!b.chave.startsWith(partes[0])))
      .slice(0, 8);
  }, [texto, itens]);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  function ir(i: ItemBusca) {
    setTexto("");
    setAberta(false);
    campo.current?.blur();
    router.push(i.href);
  }

  return (
    <div className="busca" data-livre>
      <input
        ref={campo}
        type="search"
        value={texto}
        placeholder="Procurar escola, produtor ou semana…"
        aria-label="Procurar"
        onChange={(e) => {
          setTexto(e.target.value);
          setAberta(true);
          setMarcado(0);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setMarcado((m) => Math.min(m + 1, achados.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setMarcado((m) => Math.max(m - 1, 0));
          } else if (e.key === "Enter" && achados[marcado]) {
            e.preventDefault();
            ir(achados[marcado]);
          } else if (e.key === "Escape") {
            setTexto("");
            setAberta(false);
          }
        }}
      />
      {aberta && texto.trim() && (
        <ul className="busca-lista" role="listbox">
          {achados.length === 0 && <li className="vazio">Nada encontrado.</li>}
          {achados.map((i, k) => (
            <li key={i.href + i.titulo} role="option" aria-selected={k === marcado}>
              <button type="button" className={k === marcado ? "marcado" : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => ir(i)} onMouseEnter={() => setMarcado(k)}>
                <span className="etiqueta">{i.tipo}</span>
                <span>
                  {i.titulo}
                  {i.detalhe && <small>{i.detalhe}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
