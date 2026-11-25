import { kg2, reais } from "@/lib/coop/numeros";
import { NOME_CAUSA, perdasDaSemana, type CausaPerda, type ItemPerda } from "@/lib/coop/perdas";
import { VerPerdas } from "./VerPerdas";
import { carregarSemana } from "../../../dados";
import { BotaoImprimir } from "../../../ui";

export const metadata = { title: "Perdas" };

export default async function Perdas({ params, searchParams }: PageProps<"/coop/semana/[data]/perdas">) {
  const { data } = await params;
  const q = await searchParams;
  const ver = q.ver === "produto" ? "produto" : "motivo";
  const { cad, sem, r } = await carregarSemana(data);
  const p = perdasDaSemana(cad, sem, r);
  const causas = [...new Set(p.linhas.map((l) => l.causa))];
  const descontos = cad.produtores.filter((x) => (sem.descontos?.[x.id] ?? 0) > 0);
  const semEntrega = r.resumo.entregasLancadasKg <= 0;
  return (
    <>
      <div className="botoes nao-imprimir" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <p className="discreto" style={{ margin: 0 }}>
          Perda = o que a Prefeitura não pagou (valor de venda), escola por escola. Clique numa linha para ver cada escola.
        </p>
        <span className="botoes">
          <VerPerdas ver={ver} escolhido={typeof q.ver === "string"} />
          <BotaoImprimir />
        </span>
      </div>
      <div className="folha">
        <h3 className="vermelho" style={{ fontSize: 22 }}>
          Perdas — semana {sem.referencia}
        </h3>
        <p className="linha-cab" style={{ color: "#555" }}>
          Perda = a Prefeitura não pagou (valor de venda).
          {!semEntrega && ` Entregue ${kg2(p.entreguePct).replace(/,?0+$/, "")}% do pedido.`}
          {!semEntrega && !Object.keys(sem.conferidoPrefeitura).length && " Sem a conferência da Prefeitura ainda: pode mudar."}
        </p>
        {semEntrega ? (
          <p className="aviso">Ainda não tem entrega lançada nesta semana.</p>
        ) : p.linhas.length === 0 ? (
          <p className="ok">Sem perdas: a Prefeitura pagou tudo.</p>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>O que aconteceu</th>
                <th className="n">kg</th>
                <th className="n">R$</th>
              </tr>
            </thead>
            <tbody>
              {ver === "motivo"
                ? causas.map((causa, n) => <Grupo key={causa} numero={n + 1} causa={causa} linhas={p.linhas.filter((l) => l.causa === causa)} />)
                : porProduto(p.linhas.flatMap((l) => l.itens)).map((g, n) => <GrupoProduto key={g.produto} numero={n + 1} {...g} />)}
              {p.ajusteConferencia !== 0 && (
                <tr>
                  <td>Diferença da conferência da Prefeitura (pagou {p.ajusteConferencia < 0 ? "a mais" : "a menos"} que as escolas aceitaram)</td>
                  <td className="n" />
                  <td className="n">{p.ajusteConferencia < 0 ? "− " : ""}{reais(Math.abs(p.ajusteConferencia))}</td>
                </tr>
              )}
              <tr className="perda">
                <td>
                  <strong>TOTAL DE PERDAS</strong>
                </td>
                <td className="n">
                  <strong>{kg2(p.escolas.kg)} kg</strong>
                </td>
                <td className="n">
                  <strong>{reais(p.total)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {descontos.length > 0 && (
          <table className="tabela" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Desconto de produtor (ex.: folha estragada)</th>
                <th className="n">R$</th>
              </tr>
            </thead>
            <tbody>
              {descontos.map((x) => (
                <tr key={x.id}>
                  <td>{x.nome}</td>
                  <td className="n">{reais(sem.descontos![x.id])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sem.observacao && (
          <div className="nota" style={{ marginTop: 16, borderLeftColor: "var(--c-vermelho)" }}>
            <p>{sem.observacao}</p>
          </div>
        )}
      </div>
      {!semEntrega && p.porCausa.length > 0 && (
        <div className="grade nao-imprimir" style={{ marginTop: 12 }}>
          {p.porCausa.map((c) => (
            <div key={c.causa} className="numero ruim">
              <small>{NOME_CAUSA[c.causa]}</small>
              <strong>{reais(c.valor)}</strong>
              <small>{kg2(c.kg)} kg</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Grupo({ numero, causa, linhas }: { numero: number; causa: CausaPerda; linhas: ReturnType<typeof perdasDaSemana>["linhas"] }) {
  return (
    <>
      <tr className="causa">
        <td colSpan={3}>
          {numero}. {NOME_CAUSA[causa]}
        </td>
      </tr>
      {linhas.map((l) => (
        <tr key={l.titulo}>
          <td>
            <details>
              <summary style={{ cursor: "pointer" }}>{l.titulo}</summary>
              <ul className="discreto" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {l.itens.map((i) => (
                  <li key={`${i.codigo}-${i.produto}`}>
                    {i.codigo} {i.escola} — {i.produto}: {kg2(i.kg)} kg, {reais(i.valor)}
                    {i.detalhe ? ` (${i.detalhe})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </td>
          <td className="n">{kg2(l.kg)} kg</td>
          <td className="n">{reais(l.valor)}</td>
        </tr>
      ))}
    </>
  );
}

// Por produto (como a folha de 23/11): o produto e, embaixo, cada escola com o que aconteceu.
function porProduto(itens: ItemPerda[]) {
  const grupos = new Map<string, ItemPerda[]>();
  for (const i of itens) grupos.set(i.produto, [...(grupos.get(i.produto) ?? []), i]);
  return [...grupos.entries()]
    .map(([produto, lista]) => ({ produto, itens: lista.sort((a, b) => b.valor - a.valor), kg: lista.reduce((s, i) => s + i.kg, 0), valor: lista.reduce((s, i) => s + i.valor, 0) }))
    .sort((a, b) => b.valor - a.valor);
}

function oQueHouve(i: ItemPerda): string {
  const d = i.detalhe ? i.detalhe.toLowerCase() : "";
  if (i.causa === "semReceber") return d && d !== "não recebeu" ? `não recebeu (${d})` : "não recebeu";
  if (i.causa === "devolvido") return d && d !== "recusado" ? `devolvida (${d})` : "devolvida";
  return d ? `recebeu a menos (${d})` : "recebeu a menos";
}

function GrupoProduto({ numero, produto, itens, kg, valor }: { numero: number; produto: string; itens: ItemPerda[]; kg: number; valor: number }) {
  return (
    <>
      <tr className="causa">
        <td>
          {numero}. {produto}
        </td>
        <td className="n">{kg2(kg)} kg</td>
        <td className="n">{reais(valor)}</td>
      </tr>
      {itens.map((i) => (
        <tr key={`${i.codigo}-${i.produto}`}>
          <td>
            {i.codigo} {i.escola} — {oQueHouve(i)}
          </td>
          <td className="n">{kg2(i.kg)} kg</td>
          <td className="n">{reais(i.valor)}</td>
        </tr>
      ))}
    </>
  );
}
