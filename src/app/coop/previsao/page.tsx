import Link from "next/link";
import { lerPrevisao, listarPrevisoes, listarSemanas } from "@/lib/coop/armazem";
import { somarDias, referenciaDeData } from "@/lib/coop/semana";
import { carregarCadastro } from "../dados";
import { PrevisaoTela } from "./PrevisaoTela";

export const metadata = { title: "Previsão" };

export default async function PaginaPrevisao({ searchParams }: PageProps<"/coop/previsao">) {
  const cad = await carregarCadastro();
  if (!cad) return <p className="aviso">Primeiro traga o MODELO no <Link href="/coop/cadastro">Cadastro</Link>.</p>;
  const q = await searchParams;
  const semanas = await listarSemanas();
  const previsoes = await listarPrevisoes();
  const sugerida = semanas.length ? somarDias(semanas[0], 7) : "";
  const data = typeof q.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.data) ? q.data : (previsoes[0] && previsoes[0] >= sugerida ? previsoes[0] : sugerida);
  const prev = data ? await lerPrevisao(data) : null;
  return (
    <>
      <div className="nao-imprimir">
        <h1>Previsão de produção</h1>
        <p className="sub">Antes do pedido: pergunte a cada produtor o que vai ter, cole as respostas e mande a tabela para a nutricionista.</p>
        <form className="botoes" method="get">
          <label className="campo">
            Entrega de
            <input type="date" name="data" defaultValue={data} />
          </label>
          <button className="botao claro">Abrir</button>
          {previsoes.length > 0 && (
            <span className="discreto">
              Já gravadas:{" "}
              {previsoes.map((d) => (
                <Link key={d} href={`/coop/previsao?data=${d}`} style={{ marginRight: 8 }}>
                  {referenciaDeData(d).slice(0, 5)}
                </Link>
              ))}
            </span>
          )}
        </form>
      </div>
      {data ? (
        <PrevisaoTela
          key={data}
          data={data}
          produtores={cad.produtores.map((p) => ({ id: p.id, nome: p.nome, curto: p.curto, telefone: p.telefone }))}
          produtos={cad.produtos.map((p) => p.nome)}
          inicial={prev}
        />
      ) : (
        <p className="aviso">Escolha a data da entrega.</p>
      )}
    </>
  );
}
