import Link from "next/link";
import { carregarSemana } from "../../dados";
import { Abas } from "./Abas";

export default async function LayoutSemana({ children, params }: LayoutProps<"/coop/semana/[data]">) {
  const { data } = await params;
  const { sem } = await carregarSemana(data);
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
        <Abas data={sem.data} dias={sem.diasGalpao} />
      </div>
      {children}
    </>
  );
}
