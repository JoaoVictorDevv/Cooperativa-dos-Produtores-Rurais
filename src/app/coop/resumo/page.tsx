import Link from "next/link";
import { lerSemana, listarSemanas } from "@/lib/coop/armazem";
import { calcularSemana, type ResultadoSemana } from "@/lib/coop/motor";
import type { Semana } from "@/lib/coop/tipos";
import { kg, reais } from "@/lib/coop/numeros";
import { NOMES_CUSTOS } from "@/lib/coop/semana";
import { carregarCadastro } from "../dados";
import { BotaoImprimir } from "../ui";

export const metadata = { title: "Resumo das entregas" };

const mais = (v: number) => `${v < 0 ? "− " : "+ "}${reais(Math.abs(v))}`;

export default async function Resumo({ searchParams }: PageProps<"/coop/resumo">) {
  const cad = await carregarCadastro();
  if (!cad) return <p className="aviso">Primeiro traga o MODELO no <Link href="/coop/cadastro">Cadastro</Link>.</p>;
  const q = await searchParams;
  const ate = typeof q.ate === "string" ? q.ate : "";
  const datas = (await listarSemanas()).slice().reverse();
  const semanas: { s: Semana; r: ResultadoSemana; lancou: boolean }[] = [];
  for (const d of datas) {
    const s = await lerSemana(d);
    if (!s) continue;
    const r = calcularSemana(cad, s);
    const lancou = r.resumo.entregasLancadasKg > 0;
    if (!lancou && !ate) continue; // semana ainda sem entrega não entra no resumo
    semanas.push({ s, r, lancou });
  }
  type Item = (typeof semanas)[number];
  const total = (f: (x: Item) => number) => semanas.map(f).reduce((a, b) => a + b, 0);
  const custoLinha = (k: keyof Semana["custos"]) => (x: Item) => x.s.custos[k] + (k === "administrativo" ? x.s.custos.administrativoFalta : 0);
  const linhasCusto = NOMES_CUSTOS.map(([k, nome]) => ({ k, nome: k === "administrativo" ? "Administrativo (combinado R$ pago + o que falta)" : k === "montagem" ? "Montagem (ajudantes)" : nome, f: custoLinha(k) })).filter((l) => total(l.f) > 0);
  const saldoTotal = total((x) => x.r.balanco.saldo);
  const dividaAdm = total((x) => x.s.custos.administrativoFalta);
  const curta = (ref: string) => ref.slice(0, 5);

  return (
    <>
      <div className="botoes nao-imprimir" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Resumo das entregas — PNAE</h1>
          <p className="sub">Todas as semanas com entrega lançada, lado a lado. Para o Paulo e para a assembleia.</p>
        </div>
        <div className="botoes">
          <BotaoImprimir texto="Imprimir / PDF" />
          {!ate && <Link className="botao claro" href="/coop/resumo?ate=tudo">incluir semanas sem entrega</Link>}
        </div>
      </div>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <div className="folha" >
        <h3 style={{ fontSize: 22, color: "var(--c-verde)" }}>Resumo das entregas — PNAE</h3>
        <p className="linha-cab" style={{ color: "#555" }}>
          {cad.nomeCooperativa ?? "Cooperativa"} · Chamada Pública {cad.chamada} · {cad.processo}
        </p>
        {semanas.length === 0 && <p className="aviso">Nenhuma semana com entrega lançada ainda.</p>}
        <div className="cartoes-semana">
          {semanas.map(({ s, r }) => (
            <Link key={s.data} href={`/coop/semana/${s.data}`} className={`cartao-semana${r.balanco.saldo < 0 ? " negativo" : ""}`} style={{ textDecoration: "none" }}>
              <small>Semana {curta(s.referencia)}</small>
              <strong>{mais(r.balanco.saldo)}</strong>
              <span>{s.observacao || `${s.entrega}ª entrega · ${kg(r.resumo.pedidoTotal)} kg`}</span>
            </Link>
          ))}
          {semanas.length > 1 && (
            <div className="cartao-semana total">
              <small>Total {semanas.length} semanas</small>
              <strong>{mais(saldoTotal)}</strong>
              <span>{saldoTotal >= 0 ? "saldo positivo" : "saldo negativo"}</span>
            </div>
          )}
        </div>
        <div className="rolar">
          <table className="tabela" style={{ border: 0 }}>
            <thead>
              <tr>
                <th>Valores em R$</th>
                {semanas.map(({ s }) => (
                  <th key={s.data} className="n">
                    Semana {curta(s.referencia)}
                  </th>
                ))}
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Prefeitura paga", (x: Item) => x.r.balanco.cobrado, ""],
                  ["Produtores recebem", (x: Item) => x.r.balanco.pago, ""],
                  ["Margem da cooperativa", (x: Item) => x.r.balanco.margem, "destaque"],
                ] as [string, (x: Item) => number, string][]
              ).map(([nome, f, cls]) => (
                <tr key={nome} className={cls || undefined}>
                  <td>{nome}</td>
                  {semanas.map((x) => (
                    <td key={x.s.data} className="n">
                      {reais(f(x))}
                    </td>
                  ))}
                  <td className="n">
                    <strong>{reais(total(f))}</strong>
                  </td>
                </tr>
              ))}
              <tr className="secao">
                <td colSpan={semanas.length + 2}>Custos</td>
              </tr>
              {linhasCusto.map((l) => (
                <tr key={l.k}>
                  <td>{l.nome}</td>
                  {semanas.map((x) => (
                    <td key={x.s.data} className="n">
                      {l.f(x) > 0 ? reais(l.f(x)) : "—"}
                    </td>
                  ))}
                  <td className="n">
                    <strong>{reais(total(l.f))}</strong>
                  </td>
                </tr>
              ))}
              <tr className="destaque">
                <td>Total de custos</td>
                {semanas.map((x) => (
                  <td key={x.s.data} className="n">
                    {reais(x.r.balanco.custos)}
                  </td>
                ))}
                <td className="n">{reais(total((x) => x.r.balanco.custos))}</td>
              </tr>
              <tr className="saldo">
                <td>SALDO</td>
                {semanas.map((x) => (
                  <td key={x.s.data} className={`n${x.r.balanco.saldo < 0 ? " negativo" : ""}`}>
                    {mais(x.r.balanco.saldo)}
                  </td>
                ))}
                <td className="n">{mais(saldoTotal)}</td>
              </tr>
              <tr className="perda">
                <td>Perdas (não pago pela Prefeitura)</td>
                {semanas.map((x) => (
                  <td key={x.s.data} className="n">
                    {x.r.balanco.perdas === null ? "aguardando" : reais(Math.abs(x.r.balanco.perdas))}
                  </td>
                ))}
                <td className="n">
                  <strong>{reais(total((x) => Math.abs(x.r.balanco.perdas ?? 0)))}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="notas" style={{ marginTop: 16 }}>
          <div className="nota">
            {semanas.map(({ s, r }) => (
              <p key={s.data}>
                <strong>{curta(s.referencia)}</strong> — {s.observacao || `${kg(r.resumo.pedidoTotal)} kg pedidos, ${kg(r.resumo.totais.entregueGalpao)} kg entregues no galpão.`}
              </p>
            ))}
          </div>
          <div className="nota">
            {dividaAdm > 0 && (
              <p>
                Administrativo: já está no custo o valor combinado; ainda faltam <strong>{reais(dividaAdm)}</strong> a pagar.
              </p>
            )}
            {semanas.some(({ s }) => !Object.keys(s.conferidoPrefeitura).length) && (
              <p>
                Sem conferência da Prefeitura ainda:{" "}
                {semanas
                  .filter(({ s }) => !Object.keys(s.conferidoPrefeitura).length)
                  .map(({ s }) => curta(s.referencia))
                  .join(", ")}{" "}
                — pode mudar.
              </p>
            )}
            <p>Perdas = o que saiu do galpão e a Prefeitura não pagou (faltas e recusas nas escolas).</p>
          </div>
        </div>
      </div>
    </>
  );
}
