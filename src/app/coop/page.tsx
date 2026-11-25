import Link from "next/link";
import { connection } from "next/server";
import { lerCadastro, lerMeta, lerSemana, listarPrevisoes, listarSemanas } from "@/lib/coop/armazem";
import { lembretes } from "@/lib/coop/lembretes";
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
        <p className="sub">Para começar, traga a planilha MODELO (v102) para o app (só uma vez).</p>
        <Link className="botao" href="/coop/cadastro">
          Ir para o Cadastro
        </Link>
      </>
    );
  }
  const datas = await listarSemanas();
  const semanas = (await Promise.all(datas.map((d) => lerSemana(d)))).filter((s) => s !== null);
  const calculadas = semanas.map((s) => ({ s, r: calcularSemana(cad, s) }));
  const hoje = new Date().toISOString().slice(0, 10);
  const avisos = lembretes(cad, calculadas, await listarPrevisoes(), hoje, (await lerMeta()).ultimoBackup ?? null);
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
      {avisos.length > 0 && (
        <div className="card" style={{ borderLeft: "5px solid var(--c-laranja)" }}>
          <h2 style={{ margin: "0 0 8px" }}>Lembretes</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {avisos.map((a, i) => (
              <li key={i} style={{ margin: "4px 0" }}>
                {a.nivel === "atrasado" && <span className="etiqueta vermelha">Atrasado</span>} {a.nivel === "hoje" && <span className="etiqueta amarela">Hoje</span>}{" "}
                <Link href={a.link}>{a.texto}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {semanas.length === 0 && <p className="aviso">Nenhuma semana ainda. Crie a primeira com o pedido da Prefeitura, ou traga uma semana antiga da planilha no Cadastro.</p>}
      <div className="passos">
        {calculadas.map(({ s, r }) => {
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
                <span>
                  {proximo ? `Falta: ${proximo.texto.toLowerCase()}` : "Semana fechada"}
                  {s.produtoresPagos ? " · produtores pagos ✓" : ""}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
