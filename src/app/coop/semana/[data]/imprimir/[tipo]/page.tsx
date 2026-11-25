import Link from "next/link";
import { notFound } from "next/navigation";
import type { ResultadoSemana } from "@/lib/coop/motor";
import { kg, kg2, reais } from "@/lib/coop/numeros";
import { NOMES_CUSTOS } from "@/lib/coop/semana";
import { perdasDaSemana } from "@/lib/coop/perdas";
import { limitePorProdutor } from "@/lib/coop/limite";
import type { Cadastro, DiaRota, Semana } from "@/lib/coop/tipos";
import { carregarSemana } from "../../../../dados";
import { BotaoImprimir } from "../../../../ui";
import { Excedente } from "../../Excedente";
import { Reentregas, reentregasDoDia } from "../../Reentregas";

export const metadata = { title: "Imprimir" };


export default async function Imprimir({ params, searchParams }: PageProps<"/coop/semana/[data]/imprimir/[tipo]">) {
  const { data, tipo } = await params;
  const q = await searchParams;
  const um = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const { cad, sem, r } = await carregarSemana(data);

  let conteudo: React.ReactNode;
  let paisagem = false;
  if (tipo === "produtores") conteudo = <RomaneiosProdutores cad={cad} sem={sem} r={r} dia={um("dia")} produtor={um("produtor")} />;
  else if (tipo === "escolas") conteudo = <RomaneiosEscolas cad={cad} sem={sem} r={r} dia={um("dia") === "TER" ? "TER" : "SEG"} rota={um("rota")} />;
  else if (tipo === "mapa") {
    paisagem = true;
    conteudo = <MapaImpresso cad={cad} sem={sem} r={r} dia={um("dia") === "TER" ? "TER" : "SEG"} rota={um("rota")} />;
  } else if (tipo === "dia") {
    // Pacote do dia num clique: mapa das rotas + excedente + reentregas + romaneios das escolas, na ordem do mapa.
    const d: DiaRota = um("dia") === "TER" ? "TER" : "SEG";
    conteudo = (
      <>
        <style>{`.coop .folha.mapa, .coop .folha.excedente { page: paisagem; } @page paisagem { size: A4 landscape; margin: 10mm; }`}</style>
        <MapaImpresso cad={cad} sem={sem} r={r} dia={d} />
        <Reentregas cad={cad} sem={sem} r={r} dia={d} impresso />
        <RomaneiosEscolas cad={cad} sem={sem} r={r} dia={d} />
        <RomaneiosReentrega cad={cad} sem={sem} r={r} dia={d} />
      </>
    );
  } else if (tipo === "extratos") conteudo = <Extratos cad={cad} sem={sem} r={r} produtor={um("produtor")} vendidoAno={await vendidoNoAno(cad, sem)} />;
  else if (tipo === "paulo") conteudo = <ResumoPaulo cad={cad} sem={sem} r={r} />;
  else notFound();

  // Voltar = para a aba de onde veio (e para a mesma rota no mapa).
  const base = `/coop/semana/${data}`;
  const diaRota = um("dia") === "TER" ? "TER" : "SEG";
  const rotaId = um("rota");
  const [voltar, nomeVoltar] =
    tipo === "produtores"
      ? [`${base}/galpao/${um("dia") === "2" ? "2" : "1"}`, `Galpão ${(um("dia") === "2" ? sem.diasGalpao[1] : sem.diasGalpao[0]).toLowerCase()}`]
      : tipo === "paulo" || tipo === "extratos"
        ? [`${base}/fechamento`, "Fechamento"]
        : [`${base}/mapa?dia=${diaRota}${rotaId ? `#rota-${encodeURIComponent(rotaId)}` : ""}`, "Mapa e Romaneios"];

  return (
    <>
      <style>{`@page { size: A4 ${paisagem ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <div className="botoes nao-imprimir" style={{ marginBottom: 12 }}>
        {/* Imagem só onde é folha de mandar (romaneio e mapa são muitos: só PDF). */}
        <BotaoImprimir imagem={tipo === "paulo" || tipo === "extratos"} />
        <Link className="botao claro" href={voltar}>
          ← Voltar para {nomeVoltar}
        </Link>
        <span className="discreto">Na janela de impressão, escolha a impressora ou “Salvar como PDF”.</span>
      </div>
      {conteudo}
    </>
  );
}

type P = { cad: Cadastro; sem: Semana; r: ResultadoSemana };

function Linhas({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <p key={i} style={{ borderBottom: "1px solid #999", height: 18, margin: "6px 0 0" }} />
      ))}
    </>
  );
}

// Igual à aba de cada produtor (área de impressão N1:R66).
function RomaneiosProdutores({ cad, sem, r, dia, produtor }: P & { dia?: string; produtor?: string }) {
  const [d1, d2] = sem.diasGalpao;
  const lista = cad.produtores.filter((p) => {
    if (produtor && p.id !== produtor) return false;
    const itens = Object.values(r.produtores[p.id]);
    if (dia === "1") return itens.some((x) => x.planejado1 > 0.004);
    if (dia === "2") return itens.some((x) => x.planejado2 > 0.004);
    return itens.some((x) => x.pedido > 0.004);
  });
  if (!lista.length) return <p className="aviso">Nenhum produtor com pedido.</p>;
  return (
    <>
      {lista.map((p) => {
        const itens = cad.produtos.map((pr) => ({ pr, x: r.produtores[p.id][pr.nome] })).filter(({ x }) => x.pedido > 0.004);
        return (
          <div className="folha" key={p.id}>
            <h3>Controle de entrega — produtor</h3>
            <p className="linha-cab">
              <strong>PRODUTOR:</strong> {p.nome}
            </p>
            <p className="linha-cab">
              <strong>TELEFONE:</strong> {p.telefone ?? "—"}
            </p>
            <p className="linha-cab">
              <strong>SEMANA (REFERÊNCIA):</strong> {sem.referencia} &nbsp;|&nbsp; <strong>ENTREGA</strong> {sem.entrega}
            </p>
            <table>
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th className="n">PEDIDO</th>
                  <th className="n">{d1} pedido</th>
                  <th>ENTREGA {d1}</th>
                  <th className="n">{d2} pedido</th>
                  <th>ENTREGA {d2}</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(({ pr, x }) => (
                  <tr key={pr.nome}>
                    <td>{pr.nome}</td>
                    <td className="n">
                      {kg2(x.pedido)} {pr.unidade}
                    </td>
                    <td className="n">{x.planejado1 > 0.004 ? kg2(x.planejado1) : "—"}</td>
                    <td className="escrever" />
                    <td className="n">{x.planejado2 > 0.004 ? kg2(x.planejado2) : "—"}</td>
                    <td className="escrever" />
                  </tr>
                ))}
                {[0, 1].map((i) => (
                  <tr key={`b${i}`}>
                    <td style={{ height: 26 }} />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="assina">
              <strong>OBS:</strong>
              <Linhas n={3} />
              <p>
                DATA DA ENTREGA: &nbsp; {d1.slice(0, 3)} ____/____ &nbsp;&nbsp;&nbsp; {d2.slice(0, 3)} ____/____
              </p>
              <p>ASSINATURA DO PRODUTOR: ______________________________________________</p>
              <p>ASSINATURA DO RESPONSÁVEL PELO RECEBIMENTO NO GALPÃO: ____________________________</p>
            </div>
          </div>
        );
      })}
    </>
  );
}

function enderecoEscola(endereco: string, bairro: string) {
  const i = endereco.search(/ - CEP/i);
  const rua = i >= 0 ? endereco.slice(0, i).trim() : endereco;
  const cep = i >= 0 ? endereco.slice(i + 3).trim() : "";
  return [rua, bairro, cep].filter(Boolean).join(" — ");
}

// Igual à aba de cada escola (área de impressão W1:X37), na ordem do mapa.
function RomaneiosEscolas({ cad, sem, r, dia, rota }: P & { dia: DiaRota; rota?: string }) {
  const escolas = new Map(cad.escolas.map((e) => [e.codigo, e]));
  const rotas = sem.rotas.filter((x) => x.dia === dia && (!rota || x.id === rota));
  return (
    <>
      {rotas.flatMap((ro) =>
        ro.paradas.map((pa) => {
          const e = escolas.get(pa.codigo);
          const itens = cad.produtos.filter((p) => (sem.pedidoEscolas[pa.codigo]?.[p.nome] ?? 0) > 0);
          if (!e || !itens.length) return null;
          const temCorte = itens.some((p) => (sem.pedidoEscolas[pa.codigo]?.[p.nome] ?? 0) - (r.enviado[pa.codigo]?.[p.nome] ?? 0) > 0.005);
          return (
            <div className="folha" key={`${ro.id}-${pa.codigo}`}>
              <p className="discreto" style={{ margin: 0 }}>
                {ro.titulo} · parada {pa.par}
                {pa.sub}
              </p>
              <h3>Controle de entrega — escola</h3>
              <p className="linha-cab">
                <strong>ESCOLA:</strong> {e.nome}
              </p>
              <p className="linha-cab">
                <strong>CÓDIGO:</strong> {e.codigo} &nbsp;|&nbsp; <strong>TELEFONE:</strong> {e.telefone || "—"}
              </p>
              <p className="linha-cab">
                <strong>ENDEREÇO:</strong> {enderecoEscola(e.endereco, e.bairro)}
              </p>
              <p className="linha-cab">
                <strong>CHAMADA PÚBLICA:</strong> {sem.chamada} &nbsp;|&nbsp; <strong>PROCESSO ADMINISTRATIVO:</strong> {sem.processo}
              </p>
              <p className="linha-cab">
                <strong>SEMANA (REFERÊNCIA):</strong> {sem.referencia} &nbsp;|&nbsp; <strong>ENTREGA</strong> {sem.entrega}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>PRODUTO</th>
                    <th className="n">PEDIDO</th>
                    {temCorte && <th className="n">ENVIADO</th>}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td className="n">
                        {kg2(sem.pedidoEscolas[pa.codigo][p.nome])} {p.unidade}
                      </td>
                      {temCorte && <td className="n">{kg2(r.enviado[pa.codigo]?.[p.nome] ?? 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="assina">
                <strong>OBS:</strong>
                <Linhas n={3} />
                <p>DATA DA ENTREGA: ____/____/________</p>
                <p>ASSINATURA RESPONSÁVEL: ______________________________________________</p>
                <p>MATRÍCULA: ______________________________________</p>
              </div>
            </div>
          );
        }),
      )}
    </>
  );
}

// Romaneio de novo para as escolas em reentrega neste dia (mesmos números do mapa original).
function RomaneiosReentrega({ cad, sem, r, dia }: P & { dia: DiaRota }) {
  const lista = reentregasDoDia(cad, sem, dia);
  if (!lista.length) return null;
  return (
    <>
      {lista.map(({ codigo, re, escola }) => {
        const e = escola!;
        const itens = cad.produtos.filter((p) => (sem.pedidoEscolas[codigo]?.[p.nome] ?? 0) > 0);
        return (
          <div className="folha" key={`re-${codigo}`}>
            <p className="discreto" style={{ margin: 0 }}>
              REENTREGA ({re.motivo}) · {re.quando ?? ""}
            </p>
            <h3>Controle de entrega — escola</h3>
            <p className="linha-cab">
              <strong>ESCOLA:</strong> {e.nome}
            </p>
            <p className="linha-cab">
              <strong>CÓDIGO:</strong> {e.codigo} &nbsp;|&nbsp; <strong>TELEFONE:</strong> {e.telefone || "—"}
            </p>
            <p className="linha-cab">
              <strong>ENDEREÇO:</strong> {enderecoEscola(e.endereco, e.bairro)}
            </p>
            <p className="linha-cab">
              <strong>SEMANA (REFERÊNCIA):</strong> {sem.referencia} &nbsp;|&nbsp; <strong>ENTREGA</strong> {sem.entrega}
            </p>
            <table>
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th className="n">PEDIDO</th>
                  <th className="n">ENVIADO</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((p) => (
                  <tr key={p.nome}>
                    <td>{p.nome}</td>
                    <td className="n">
                      {kg2(sem.pedidoEscolas[codigo][p.nome])} {p.unidade}
                    </td>
                    <td className="n">{kg2(r.enviado[codigo]?.[p.nome] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="assina">
              <strong>OBS:</strong>
              <Linhas n={3} />
              <p>DATA DA ENTREGA: ____/____/________</p>
              <p>ASSINATURA RESPONSÁVEL: ______________________________________________</p>
              <p>MATRÍCULA: ______________________________________</p>
            </div>
          </div>
        );
      })}
    </>
  );
}

function MapaImpresso({ cad, sem, r, dia, rota }: P & { dia: DiaRota; rota?: string }) {
  const rotas = sem.rotas.filter((x) => x.dia === dia && (!rota || x.id === rota));
  return (
    <>
      {rotas.map((ro) => {
        const produtos = r.ordemMapa.map((nome) => cad.produtos.find((p) => p.nome === nome)!).filter((p) => ro.paradas.some((pa) => (r.enviado[pa.codigo]?.[p.nome] ?? 0) > 0.0001));
        return (
          <div className="folha mapa" key={ro.id}>
            <h3>Mapa de montagem — {sem.referencia}</h3>
            <p className="linha-cab">
              <strong>{ro.titulo}</strong>
            </p>
            {ro.saida && <p className="linha-cab">{ro.saida}</p>}
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>CÓD.</th>
                  <th>ESCOLA</th>
                  <th>BAIRRO</th>
                  {produtos.map((p) => (
                    <th key={p.nome} className="n">
                      {p.nome}
                    </th>
                  ))}
                  <th>✓</th>
                </tr>
              </thead>
              <tbody>
                {ro.paradas.map((pa) => (
                  <tr key={pa.codigo}>
                    <td>
                      {pa.par}
                      {pa.sub}
                    </td>
                    <td>{pa.codigo}</td>
                    <td>{pa.nomeMapa}</td>
                    <td>{pa.bairro}</td>
                    {produtos.map((p) => {
                      const v = r.enviado[pa.codigo]?.[p.nome] ?? 0;
                      return (
                        <td key={p.nome} className="n">
                          {v > 0.0001 ? kg2(v) : ""}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}>
                    <strong>TOTAL DA ROTA</strong>
                  </td>
                  {produtos.map((p) => (
                    <td key={p.nome} className="n">
                      <strong>{kg2(ro.paradas.reduce((s, pa) => s + (r.enviado[pa.codigo]?.[p.nome] ?? 0), 0))}</strong>
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      {!rota && <Excedente dia={dia} ex={r.excedente[dia]} rotas={sem.rotas} unidade={(p) => cad.produtos.find((x) => x.nome === p)?.unidade ?? "kg"} impresso comLegumes={cad.excedenteLegumes} />}
    </>
  );
}

// Quanto cada produtor já vendeu no ano até esta semana, pelo valor de venda (só informação).
async function vendidoNoAno(cad: Cadastro, sem: Semana): Promise<Record<string, number>> {
  const l = await limitePorProdutor(cad, sem.data);
  return Object.fromEntries(l.linhas.map((x) => [x.id, x.total]));
}

// Demonstrativo de entrega do produtor (o modelo que o João manda).
function Extratos({ cad, sem, r, produtor, vendidoAno }: P & { produtor?: string; vendidoAno: Record<string, number> }) {
  const lista = cad.produtores.filter((p) => (!produtor || p.id === produtor) && (r.pagarProdutor[p.id] > 0 || Object.values(r.produtores[p.id]).some((x) => x.pedido > 0)));
  const titulo = (cad.nomeCooperativa ?? "Cooperativa").toUpperCase();
  return (
    <>
      {lista.map((p) => {
        const itens = cad.produtos.map((pr) => ({ pr, x: r.produtores[p.id][pr.nome] })).filter(({ x }) => x.pedido > 0 || x.entregue > 0);
        const desconto = r.descontoProdutor[p.id] ?? 0;
        return (
          <div className="folha demonstrativo" key={p.id} data-arquivo={`demonstrativo ${p.curto} ${sem.referencia.slice(0, 5)}`}>
            <p className="titulo-coop">
              <strong>{titulo}</strong>
            </p>
            <h3>Demonstrativo de entrega — produtor</h3>
            <p className="linha-cab">
              <strong>PRODUTOR:</strong> {p.nome}
            </p>
            <p className="linha-cab">
              <strong>TELEFONE:</strong> {p.telefone ?? "—"}
            </p>
            <p className="linha-cab">
              <strong>SEMANA (REFERÊNCIA):</strong> {sem.referencia} &nbsp;|&nbsp; ENTREGA {sem.entrega} &nbsp;|&nbsp; Chamada Pública {sem.chamada} · {sem.processo}
            </p>
            <table>
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th>PEDIDO ({itens[0]?.pr.unidade ?? "kg"})</th>
                  <th>ENTREGUE (kg)</th>
                  <th>ACEITO / PAGO (kg)</th>
                  <th>PREÇO LÍQUIDO (R$/kg)</th>
                  <th>VALOR (R$)</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(({ pr, x }) => (
                  <tr key={pr.nome}>
                    <td>{pr.nome}</td>
                    <td className="n">{kg2(x.pedido)}</td>
                    <td className="n">{kg2(x.entregue)}</td>
                    <td className="n forte">{kg2(x.pagoKg)}</td>
                    <td className="n">{reais(x.precoLiquido)}</td>
                    <td className="n forte">{reais(x.valor)}</td>
                  </tr>
                ))}
                {desconto > 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "right" }}>
                      Desconto (ex.: folha estragada)
                    </td>
                    <td className="n forte" style={{ color: "var(--c-vermelho)" }}>
                      − {reais(desconto)}
                    </td>
                  </tr>
                )}
                <tr className="total">
                  <td colSpan={5} style={{ textAlign: "right" }}>
                    VALOR TOTAL A RECEBER
                  </td>
                  <td className="n">{reais(r.pagarProdutor[p.id])}</td>
                </tr>
              </tbody>
            </table>
            <p className="rodape">
              Pago = o que foi aceito no galpão, até o pedido de cada produto. Preço líquido = preço de venda − R$ {kg(cad.taxaLogistica)}/kg (taxa de logística da cooperativa).
            </p>
            <p className="rodape nao-imprimir">
              Só para você (não sai na impressão): vendido no ano até esta semana {reais(vendidoAno[p.id] ?? 0)} (valor de venda) — limite de R$ 40.000,00, só informação.
            </p>
          </div>
        );
      })}
    </>
  );
}

function ResumoPaulo({ cad, sem, r }: P) {
  const b = r.balanco;
  const produtos = r.resumo.produtos.filter((p) => p.pedido > 0 || p.entregueGalpao > 0);
  return (
    <div className="folha" style={{ fontSize: 13 }}>
      <h3>Resumo da semana {sem.referencia} — entrega {sem.entrega}</h3>
      <p className="linha-cab">
        {sem.chamada} · {sem.processo} · galpão: {sem.diasGalpao[0].toLowerCase()} e {sem.diasGalpao[1].toLowerCase()}
      </p>
      <table>
        <tbody>
          <tr>
            <td>Cobrar da Prefeitura</td>
            <td className="n">
              <strong>{reais(b.cobrado)}</strong>
            </td>
            <td>Pedido (com cortes)</td>
            <td className="n">{kg(r.resumo.pedidoTotal)} kg</td>
          </tr>
          <tr>
            <td>Pagar aos produtores</td>
            <td className="n">{reais(b.pago)}</td>
            <td>Taxa de logística (R$ {kg(cad.taxaLogistica)}/kg)</td>
            <td className="n">{reais(r.resumo.taxaLogistica)}</td>
          </tr>
          <tr>
            <td>Custos da semana</td>
            <td className="n">{reais(b.custos)}</td>
            <td>Perdas</td>
            <td className="n">{reais(perdasDaSemana(cad, sem, r).total)}</td>
          </tr>
          <tr>
            <td>
              <strong>Saldo</strong>
            </td>
            <td className="n">
              <strong>{reais(b.saldo)}</strong>
            </td>
            <td>Conferência da Prefeitura</td>
            <td className="n">{Object.keys(sem.conferidoPrefeitura).length ? "recebida" : "ainda não"}</td>
          </tr>
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            <th>Custos</th>
            <th className="n">R$</th>
          </tr>
        </thead>
        <tbody>
          {NOMES_CUSTOS.map(([k, nome]) => (
            <tr key={k}>
              <td>{nome}</td>
              <td className="n">{reais(sem.custos[k])}</td>
            </tr>
          ))}
          {sem.custos.administrativoFalta > 0 && (
            <tr>
              <td>Administrativo — ficou faltando (dívida da cooperativa)</td>
              <td className="n">{reais(sem.custos.administrativoFalta)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="n">Pedido</th>
            <th className="n">Galpão</th>
            <th className="n">Cobrado</th>
            <th className="n">Cobrar</th>
            <th className="n">Pagar</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.produto}>
              <td>{p.produto}</td>
              <td className="n">{kg(p.pedido)}</td>
              <td className="n">{kg(p.entregueGalpao)}</td>
              <td className="n">{kg(p.cobradoKg)}</td>
              <td className="n">{reais(p.valorCobrado)}</td>
              <td className="n">{reais(p.valorPago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            <th>Produtor</th>
            <th className="n">A pagar</th>
          </tr>
        </thead>
        <tbody>
          {cad.produtores
            .filter((p) => r.pagarProdutor[p.id] > 0)
            .map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td className="n">{reais(r.pagarProdutor[p.id])}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

