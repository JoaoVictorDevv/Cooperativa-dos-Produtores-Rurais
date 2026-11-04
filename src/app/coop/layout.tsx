import type { Metadata } from "next";
import Link from "next/link";
import { modoLocal } from "@/lib/coop/armazem";
import "./coop.css";

export const metadata: Metadata = { title: { default: "Cooperativa", template: "%s · Cooperativa" } };
export const dynamic = "force-dynamic";

export default function CoopLayout({ children }: LayoutProps<"/coop">) {
  if (!modoLocal()) {
    return (
      <div className="coop">
        <main className="coop-main">
          <h1>App da Cooperativa</h1>
          <p className="aviso">Este app só abre no computador da cooperativa. Abra com: npm run coop</p>
        </main>
      </div>
    );
  }
  return (
    <div className="coop">
      <header className="coop-top nao-imprimir">
        <Link href="/coop" className="marca">
          Cooperativa
        </Link>
        <nav>
          <Link href="/coop">Semanas</Link>
          <Link href="/coop/previsao">Previsão</Link>
          <Link href="/coop/relatorios">Relatórios</Link>
          <Link href="/coop/cadastro">Cadastro</Link>
        </nav>
      </header>
      <main className="coop-main">{children}</main>
    </div>
  );
}
