import Link from "next/link";
import { connection } from "next/server";
import { lerCadastro, lerSemana, listarSemanas } from "@/lib/coop/armazem";
import { calcularSemana } from "@/lib/coop/motor";
import { reais, kg } from "@/lib/coop/numeros";
import { listinha } from "@/lib/coop/semana";

export const metadata = { title: "Semanas" };

export default async function Inicio() {
  await connection();
  const cad = await lerCadastro();
  if (!cad) {
    return (
      <>
        <h1>Bem-vindo, João</h1>
        <p className="sub">Para começar, traga a planilha MODELO v99 para o app (só uma vez).</p>
        <Link className="botao" href="/coop/cadastro">
          Ir para o Cadastro
        </Link>
      </>
    );
  }
  const datas = await listarSemanas();
  const semanas = (await Promise.all(datas.map((d) => lerSemana(d)))).filter((s) => s !== null);
  return (
    <>
      <div className="botoes" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Semanas</h1>
          <p className="sub">Cada semana é um arquivo separado. Clique para abrir.</p>
        </div>
        <Link className="botao" href="/coop/nova">
          + Nova semana (pedido da Prefeitura)
        </Link>
      </div>
      {semanas.length === 0 && <p className="aviso">Nenhuma semana ainda. Crie a primeira com o pedido da Prefeitura, ou traga uma semana antiga da planilha no Cadastro.</p>}
      <div className="passos">
        {semanas.map((s) => {
          const r = calcularSemana(cad, s);
          const itens = listinha(cad, s, r);
          const feitos = itens.filter((i) => i.feito).length;
          const proximo = itens.find((i) => !i.feito);
          return (
            <Link key={s.data} href={`/coop/semana/${s.data}`} className={`passo${feitos === itens.length ? " feito" : ""}`}>
              <div className="bola">{feitos === itens.length ? "✓" : `${feitos}/${itens.length}`}</div>
              <div>
                <strong>
                  Semana {s.referencia} · entrega {s.entrega}
                </strong>
                <span>
                  {kg(r.resumo.pedidoTotal)} kg · cobrar {reais(r.resumo.cobrar)} · saldo {reais(r.balanco.saldo)}
                </span>
                <br />
                <span>{proximo ? `Falta: ${proximo.texto.toLowerCase()}` : "Semana fechada"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
