import Link from "next/link";
import { kg, reais } from "@/lib/coop/numeros";
import type { ResultadoSemana } from "@/lib/coop/motor";
import type { Cadastro, Semana } from "@/lib/coop/tipos";
import { listinha } from "@/lib/coop/semana";
import { perdasDaSemana } from "@/lib/coop/perdas";
import { carregarSemana } from "../../dados";
import { ApagarSemana } from "./ApagarSemana";

const LINKS: Record<string, string> = {
  pedido: "",
  mensagens: "/pedido",
  dia1: "/galpao/1",
  dia2: "/galpao/2",
  retornos: "/retornos",
  prefeitura: "/fechamento",
  custos: "/fechamento",
};

export default async function ResumoSemana({ params }: PageProps<"/coop/semana/[data]">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const itens = listinha(cad, sem, r);
  const perdas = perdasDaSemana(cad, sem, r);
  const base = `/coop/semana/${data}`;
  const faltas = Object.entries(r.faltaNaDivisao).filter(([, v]) => v >= 0.005);
  return (
    <>
      <h2 style={{ marginTop: 0 }}>O que falta</h2>
      <div className="passos">
        {itens.map((i, k) => (
          <Link key={i.chave} href={`${base}${LINKS[i.chave] ?? ""}`} className={`passo${i.feito ? " feito" : ""}`}>
            <div className="bola">{i.feito ? "✓" : k + 1}</div>
            <div>
              <strong>{i.texto}</strong>
              {i.detalhe && <span>{i.detalhe}</span>}
            </div>
          </Link>
        ))}
      </div>
      {faltas.length > 0 && (
        <p className="aviso">
          Os produtores não têm tudo no Mapa de Produção:{" "}
          {faltas.map(([p, v]) => `${p} falta ${kg(v)} kg`).join(", ")}. Veja em <Link href={`${base}/pedido`}>Pedido</Link>.
        </p>
      )}
      <h2>Números da semana</h2>
      <div className="grade">
        <div className="numero">
          <small>Pedido (já com os cortes)</small>
          <strong>{kg(r.resumo.pedidoTotal)} kg</strong>
        </div>
        <div className="numero">
          <small>Cobrar da Prefeitura</small>
          <strong>{reais(r.resumo.cobrar)}</strong>
        </div>
        <div className="numero">
          <small>Pagar aos produtores</small>
          <strong>{reais(r.resumo.pagar)}</strong>
        </div>
        <div className="numero">
          <small>Taxa de logística (R$ {kg(cad.taxaLogistica)}/kg)</small>
          <strong>{reais(r.resumo.taxaLogistica)}</strong>
        </div>
        <Link href={`${base}/perdas`} className={`numero${perdas.total > 0.004 ? " ruim" : ""}`}>
          <small>Perdas (Prefeitura não pagou) — ver de onde veio ›</small>
          <strong>{r.resumo.entregasLancadasKg > 0 ? reais(perdas.total) : "sem entrega ainda"}</strong>
        </Link>
        <div className={`numero ${r.balanco.saldo >= 0 ? "bom" : "ruim"}`}>
          <small>Saldo (balanço)</small>
          <strong>{reais(r.balanco.saldo)}</strong>
        </div>
        {r.balanco.administrativoFalta > 0 && (
          <div className="numero ruim">
            <small>Administrativo que ficou faltando (já contado no custo)</small>
            <strong>{reais(r.balanco.administrativoFalta)}</strong>
          </div>
        )}
      </div>
      <OndeFalta cad={cad} sem={sem} r={r} base={base} />
      <h2>Por produto</h2>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="n">Pedido</th>
              <th className="n">Entregue no galpão</th>
              <th className="n">Pago (kg)</th>
              <th className="n">Cobrado (kg)</th>
              <th className="n">Cobrar</th>
              <th className="n">Pagar</th>
            </tr>
          </thead>
          <tbody>
            {r.resumo.produtos
              .filter((p) => p.pedido > 0 || p.entregueGalpao > 0)
              .map((p) => (
                <tr key={p.produto}>
                  <td>{p.produto}</td>
                  <td className="n">{kg(p.pedido)}</td>
                  <td className="n">{kg(p.entregueGalpao)}</td>
                  <td className="n">{kg(p.pagoKg)}</td>
                  <td className="n">{kg(p.cobradoKg)}</td>
                  <td className="n">{reais(p.valorCobrado)}</td>
                  <td className="n">{reais(p.valorPago)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="n">{kg(r.resumo.totais.pedido)}</td>
              <td className="n">{kg(r.resumo.totais.entregueGalpao)}</td>
              <td className="n">{kg(r.resumo.totais.pagoKg)}</td>
              <td className="n">{kg(r.resumo.totais.cobradoKg)}</td>
              <td className="n">{reais(r.resumo.totais.valorCobrado)}</td>
              <td className="n">{reais(r.resumo.totais.valorPago)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="botoes nao-imprimir" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <ApagarSemana data={sem.data} referencia={sem.referencia} />
      </div>
    </>
  );
}

// "Onde está faltando" (aba DIFERENÇA da planilha): escolas que receberam menos
// que o pedido e ainda não têm decisão (reentrega, 2ª viagem ou "encerrada").
function OndeFalta({ cad, sem, r, base }: { cad: Cadastro; sem: Semana; r: ResultadoSemana; base: string }) {
  const nomes = new Map(cad.escolas.map((e) => [e.codigo, e.nome]));
  const linhas: { codigo: string; nome: string; itens: string[]; kg: number }[] = [];
  for (const [codigo, fichas] of Object.entries(r.fichas)) {
    const itens: string[] = [];
    let total = 0;
    for (const [produto, f] of Object.entries(fichas)) {
      const falta = f.bruto === null ? Math.max(f.pedido - f.enviado, 0) : f.falta;
      if (falta < 0.005 || f.situacao || f.segundaViagem > 0.004) continue;
      itens.push(`${produto} ${kg(falta)}`);
      total += falta;
    }
    if (itens.length && !sem.reentregas?.[codigo]) linhas.push({ codigo, nome: nomes.get(codigo) ?? codigo, itens, kg: total });
  }
  if (!linhas.length) return null;
  linhas.sort((a, b) => b.kg - a.kg);
  return (
    <>
      <h2>Onde está faltando (sem decisão)</h2>
      <p className="discreto">
        Escolas que ficaram com menos que o pedido e ainda não têm reentrega, 2ª viagem nem “encerrada sem atendimento”. Resolva em{" "}
        <Link href={`${base}/retornos`}>Retornos</Link> ou lance a entrega extra no <Link href={`${base}/galpao/1`}>Galpão</Link>.
      </p>
      <div className="card rolar">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cód.</th>
              <th>Escola</th>
              <th>Falta</th>
              <th className="n">kg</th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 40).map((l) => (
              <tr key={l.codigo}>
                <td>{l.codigo}</td>
                <td>{l.nome}</td>
                <td>{l.itens.join(" · ")}</td>
                <td className="n">{kg(l.kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length > 40 && <p className="discreto">… e mais {linhas.length - 40} escolas.</p>}
      </div>
    </>
  );
}
