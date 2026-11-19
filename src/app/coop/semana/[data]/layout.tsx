import Link from "next/link";
import { Suspense } from "react";
import { listinha } from "@/lib/coop/semana";
import { carregarSemana } from "../../dados";
import { Abas, ProximaAba } from "./Abas";

export default async function LayoutSemana({ children, params }: LayoutProps<"/coop/semana/[data]">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const itens = listinha(cad, sem, r);
  const ok = (chave: string) => itens.find((i) => i.chave === chave)?.feito ?? false;
  const feito = {
    resumo: itens.every((i) => i.feito),
    pedido: ok("mensagens"),
    galpao1: ok("dia1"),
    galpao2: ok("dia1") && ok("dia2"),
    // O mapa fica pronto quando os dois dias de galpão estão lançados.
    mapa: ok("dia1") && ok("dia2"),
    retornos: ok("retornos"),
    fechamento: ok("custos"),
  };
  return (
    <>
      <div className="nao-imprimir">
        <Link className="voltar" href="/coop">
          ← Semanas
        </Link>
        <h1>
          Semana {sem.referencia} · entrega {sem.entrega}
        </h1>
        <p className="sub">
          Produtores trazem no galpão: {sem.diasGalpao[0].toLowerCase()} e {sem.diasGalpao[1].toLowerCase()} · {sem.chamada} · {sem.processo}
        </p>
        <Suspense>
          <Abas data={sem.data} dias={sem.diasGalpao} feito={feito} />
        </Suspense>
      </div>
      {children}
      <ProximaAba data={sem.data} dias={sem.diasGalpao} feito={feito} />
    </>
  );
}
