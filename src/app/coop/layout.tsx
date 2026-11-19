import type { Metadata } from "next";
import Link from "next/link";
import { lerCadastro, modoLocal } from "@/lib/coop/armazem";
import { MenuTopo } from "./MenuTopo";
import "./coop.css";

export const metadata: Metadata = { title: { default: "Cooperativa", template: "%s · Cooperativa" }, icons: { icon: "/coop/logo.jpg" } };
export const dynamic = "force-dynamic";

export default async function CoopLayout({ children }: LayoutProps<"/coop">) {
  const cad = modoLocal() ? await lerCadastro() : null;
  const nome = cad?.nomeCooperativa ?? "Cooperativa";
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
    <div className="coop" style={{ "--nome": JSON.stringify(nome) } as React.CSSProperties}>
      <header className="coop-top nao-imprimir">
        <Link href="/coop" className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coop/logo.jpg" alt="" />
          <span>
            {nome}
            <small>{cad?.cidade ? `${cad.cidade} · ` : ""}PNAE · merenda escolar</small>
          </span>
        </Link>
        <MenuTopo />
      </header>
      <main className="coop-main">{children}</main>
    </div>
  );
}
