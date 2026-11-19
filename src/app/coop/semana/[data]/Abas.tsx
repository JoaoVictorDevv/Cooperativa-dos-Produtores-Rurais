"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Abas({ data, dias }: { data: string; dias: [string, string] }) {
  const atual = usePathname();
  const base = `/coop/semana/${data}`;
  const abas: [string, string][] = [
    [base, "Resumo"],
    [`${base}/pedido`, "1. Pedido e mensagens"],
    [`${base}/galpao/1`, `2. Galpão ${dias[0].toLowerCase()}`],
    [`${base}/galpao/2`, `3. Galpão ${dias[1].toLowerCase()}`],
    [`${base}/mapa`, "4. Mapa e romaneios"],
    [`${base}/retornos`, "5. Retornos das escolas"],
    [`${base}/fechamento`, "6. Fechamento"],
  ];
  return (
    <nav className="abas nao-imprimir">
      {abas.map(([href, texto]) => (
        <Link key={href} href={href} className={atual === href || (href !== base && atual.startsWith(href)) ? "ativa" : undefined}>
          {texto}
        </Link>
      ))}
    </nav>
  );
}
