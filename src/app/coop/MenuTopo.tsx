"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS: [string, string][] = [
  ["/coop", "Semanas"],
  ["/coop/resumo", "Resumo"],
  ["/coop/previsao", "Previsão"],
  ["/coop/relatorios", "Relatórios"],
  ["/coop/cadastro", "Cadastro"],
];

export function MenuTopo() {
  const atual = usePathname();
  const ativo = (href: string) => (href === "/coop" ? atual === "/coop" || atual.startsWith("/coop/semana") || atual.startsWith("/coop/nova") : atual.startsWith(href));
  return (
    <nav>
      {ITENS.map(([href, texto]) => (
        <Link key={href} href={href} className={ativo(href) ? "ativa" : undefined}>
          {texto}
        </Link>
      ))}
    </nav>
  );
}
