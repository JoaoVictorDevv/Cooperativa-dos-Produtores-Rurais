"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const CHAVE = "coop-perdas-ver";

// Dois botões grandes: "Por motivo" | "Por produto". Lembra o último escolhido.
export function VerPerdas({ ver, escolhido }: { ver: "motivo" | "produto"; escolhido: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  useEffect(() => {
    if (escolhido) return;
    try {
      if (localStorage.getItem(CHAVE) === "produto") router.replace(`${caminho}?ver=produto`);
    } catch {
      // sem memória do navegador: fica "por motivo"
    }
  }, [escolhido, caminho, router]);
  const lembrar = (v: string) => {
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      // tudo bem
    }
  };
  return (
    <nav className="alternar nao-imprimir" aria-label="Como agrupar as perdas">
      <Link href={`${caminho}?ver=motivo`} className={ver === "motivo" ? "ativo" : undefined} onClick={() => lembrar("motivo")} replace>
        Por motivo
      </Link>
      <Link href={`${caminho}?ver=produto`} className={ver === "produto" ? "ativo" : undefined} onClick={() => lembrar("produto")} replace>
        Por produto
      </Link>
    </nav>
  );
}
