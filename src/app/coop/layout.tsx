import type { Metadata } from "next";
import Link from "next/link";
import { lerCadastro, lerSemana, listarSemanas, modoLocal } from "@/lib/coop/armazem";
import { referenciaDeData } from "@/lib/coop/semana";
import { semAcento } from "@/lib/coop/texto";
import { Busca, type ItemBusca } from "./Busca";
import { VigiaNaoSalvo } from "./VigiaNaoSalvo";
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
  // Itens da busca do topo. Escola abre os retornos da semana mais nova que tem pedido para ela.
  const datas = await listarSemanas();
  const ultimaDaEscola = new Map<string, string>();
  for (const d of datas) {
    const s = await lerSemana(d);
    for (const cod of Object.keys(s?.pedidoEscolas ?? {})) if (!ultimaDaEscola.has(cod)) ultimaDaEscola.set(cod, d);
  }
  const itensBusca: ItemBusca[] = [
    ...datas.map((d) => ({ tipo: "Semana" as const, titulo: `Semana ${referenciaDeData(d)}`, href: `/coop/semana/${d}`, chave: semAcento(`semana ${referenciaDeData(d)}`) })),
    ...(cad?.produtores ?? []).map((p) => ({ tipo: "Produtor" as const, titulo: p.nome, detalhe: "ficha do produtor", href: `/coop/produtor/${encodeURIComponent(p.id)}`, chave: semAcento(`${p.nome} ${p.curto}`) })),
    ...(cad?.escolas ?? []).map((e) => {
      const d = ultimaDaEscola.get(e.codigo);
      return {
        tipo: "Escola" as const,
        titulo: `${e.codigo} ${e.nome}`,
        detalhe: d ? `retornos da semana ${referenciaDeData(d).slice(0, 5)}` : "sem pedido nas semanas do app",
        href: d ? `/coop/semana/${d}/retornos?busca=${encodeURIComponent(e.codigo)}` : "/coop/cadastro",
        chave: semAcento(`${e.codigo} ${e.nome}`),
      };
    }),
  ];
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
        <Busca itens={itensBusca} />
        <MenuTopo />
      </header>
      <main className="coop-main">{children}</main>
      <VigiaNaoSalvo />
    </div>
  );
}
