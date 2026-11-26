import Link from "next/link";
import { notFound } from "next/navigation";
import type { ResultadoSemana } from "@/lib/coop/motor";
import { kg, kg2, kgMensagem, reais } from "@/lib/coop/numeros";
import { NOMES_CUSTOS, dataDaRota, datasDoGalpao } from "@/lib/coop/semana";
import { perdasDaSemana } from "@/lib/coop/perdas";
import { recusadoNoGalpao } from "@/lib/coop/mensagens";
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

// Controle de entrega do produtor (igual ao modelo do João, 30/11): pedido, espaço para anotar
// o que chegou em cada dia, datas já preenchidas e a divisão da entrega por dia.
function RomaneiosProdutores({ cad, sem, r, dia, produtor }: P & { dia?: string; produtor?: string }) {
  const [d1, d2] = sem.diasGalpao;
  const [data1, data2] = datasDoGalpao(sem);
  const titulo = (cad.nomeCooperativa ?? "Cooperativa").toUpperCase();
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
        const doDia = (campo: "planejado1" | "planejado2") => itens.filter(({ x }) => x[campo] > 0.004);
        return (
          <div className="folha demonstrativo romaneio-prod" key={p.id} data-arquivo={`romaneio ${p.curto} ${sem.referencia.slice(0, 5)}`}>
            <p className="titulo-coop">
              <strong>{titulo}</strong>
            </p>
            <h3>Controle de entrega — produtor</h3>
            <p className="linha-cab">
              <strong>PRODUTOR: {p.nome}</strong>
            </p>
            <p className="linha-cab">TELEFONE: {p.telefone ?? "—"}</p>
            <p className="linha-cab">
              <strong>SEMANA (REFERÊNCIA): {sem.referencia}</strong> &nbsp;&nbsp;|&nbsp;&nbsp; <strong>ENTREGA {sem.entrega}</strong>
            </p>
            <table style={{ maxWidth: 560 }}>
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th>PEDIDO</th>
                  <th>ENTREGA {d1}</th>
                  <th>ENTREGA {d2}</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(({ pr, x }) => (
                  <tr key={pr.nome}>
                    <td>{pr.nome}</td>
                    <td style={{ textAlign: "center" }}>
                      {kg2(x.pedido)} {pr.unidade}
                    </td>
                    <td className="escrever" />
                    <td className="escrever" />
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="assina">
              <strong>OBS:</strong>
              <Linhas n={2} />
              <p>
                <strong>
                  DATA DA ENTREGA: &nbsp; {d1} {data1} &nbsp;&nbsp;&nbsp;&nbsp; {d2} {data2}
                </strong>
              </p>
              <p>
                <strong>ASSINATURA DO PRODUTOR:</strong>
              </p>
              <Linhas n={1} />
              <p>
                <strong>ASSINATURA DO RESPONSÁVEL PELO RECEBIMENTO NO GALPÃO:</strong>
              </p>
              <Linhas n={1} />
            </div>
            <div className="divisao">
              <p className="divisao-titulo">DIVISÃO DA ENTREGA</p>
              {(
                [
                  [d1, doDia("planejado1"), "planejado1"],
                  [d2, doDia("planejado2"), "planejado2"],
                ] as const
              )
                .filter(([, l]) => l.length)
                .map(([nome, l, campo]) => (
                  <div key={nome}>
                    <p>{nome}:</p>
                    {l.map(({ pr, x }) => (
                      <p key={pr.nome}>
                        • {pr.nome}: {kgMensagem(x[campo])} {pr.unidade}
                      </p>
                    ))}
                  </div>
                ))}
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

// Controle de entrega da escola (igual ao modelo do João, 24/11), na ordem do mapa.
function FolhaEscola({ cad, sem, r, codigo, data, aviso, mostrarEnviado }: P & { codigo: string; data?: string | null; aviso?: string; mostrarEnviado?: boolean }) {
  const e = cad.escolas.find((x) => x.codigo === codigo);
  const itens = cad.produtos.filter((p) => (sem.pedidoEscolas[codigo]?.[p.nome] ?? 0) > 0);
  if (!e || !itens.length) return null;
  const ped = (p: string) => sem.pedidoEscolas[codigo]?.[p] ?? 0;
  const env = (p: string) => r.enviado[codigo]?.[p] ?? 0;
  // Coluna ENVIADO só quando faltou produto para esta escola (a escola vê o que foi de verdade).
  const enviado = mostrarEnviado || itens.some((p) => ped(p.nome) - env(p.nome) > 0.005);
  return (
    <div className="folha demonstrativo romaneio-prod romaneio-escola" data-arquivo={`romaneio escola ${e.codigo}`}>
      {aviso && <p className="aviso-folha nao-imprimir">{aviso}</p>}
      <p className="titulo-coop">
        <strong>{(cad.nomeCooperativa ?? "Cooperativa").toUpperCase()}</strong>
      </p>
      <h3>Controle de entrega — escola</h3>
      <p className="linha-cab">
        <strong>ESCOLA: {e.nome}</strong>
      </p>
      <p className="linha-cab">
        CÓDIGO: {e.codigo} &nbsp;&nbsp;|&nbsp;&nbsp; TELEFONE: {e.telefone || "—"}
      </p>
      <p className="linha-cab">ENDEREÇO: {enderecoEscola(e.endereco, e.bairro)}</p>
      <p className="linha-cab">
        CHAMADA PÚBLICA: {sem.chamada} &nbsp;&nbsp;|&nbsp;&nbsp; PROCESSO ADMINISTRATIVO: {sem.processo}
      </p>
      <p className="linha-cab">
        <strong>SEMANA (REFERÊNCIA): {sem.referencia}</strong> &nbsp;&nbsp;|&nbsp;&nbsp; <strong>ENTREGA {sem.entrega}</strong>
      </p>
      <table style={{ maxWidth: 680 }}>
        <thead>
          <tr>
            <th>PRODUTO</th>
            <th>PEDIDO</th>
            {enviado && <th>ENVIADO</th>}
          </tr>
        </thead>
        <tbody>
          {itens.map((p) => (
            <tr key={p.nome}>
              <td>{p.nome}</td>
              <td style={{ textAlign: "center" }}>
                {kg2(ped(p.nome))} {p.unidade}
              </td>
              {enviado && (
                <td style={{ textAlign: "center" }}>
                  {kg2(env(p.nome))} {p.unidade}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="assina">
        <strong>OBS:</strong>
        <Linhas n={2} />
        <p>
          <strong>DATA DA ENTREGA:</strong> &nbsp;{data ?? "____/____/________"}
        </p>
        <p>
          <strong>ASSINATURA RESPONSÁVEL:</strong>
        </p>
        <Linhas n={1} />
        <p>
          <strong>MATRÍCULA:</strong> ______________________________
        </p>
      </div>
    </div>
  );
}

function RomaneiosEscolas({ cad, sem, r, dia, rota }: P & { dia: DiaRota; rota?: string }) {
  const rotas = sem.rotas.filter((x) => x.dia === dia && (!rota || x.id === rota));
  return (
    <>
      {rotas.flatMap((ro) =>
        ro.paradas.map((pa) => (
          <FolhaEscola key={`${ro.id}-${pa.codigo}`} cad={cad} sem={sem} r={r} codigo={pa.codigo} data={dataDaRota(sem, ro.titulo)} aviso={`${ro.titulo} · parada ${pa.par}${pa.sub ?? ""}`} />
        )),
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
      {lista.map(({ codigo, re }) => (
        <FolhaEscola key={`re-${codigo}`} cad={cad} sem={sem} r={r} codigo={codigo} mostrarEnviado aviso={`REENTREGA (${re.motivo}) · ${re.quando ?? ""}`} />
      ))}
    </>
  );
}

// Mapa de montagem igual ao da planilha (MAPA DE MONTAGEM, uma folha por rota):
// só as escolas que recebem, todas as colunas de produto da semana, amarelo = vai na
// caixa da escola, laranja = a escola recebe menos que o pedido.
function MapaImpresso({ cad, sem, r, dia, rota }: P & { dia: DiaRota; rota?: string }) {
  const rotas = sem.rotas.filter((x) => x.dia === dia && (!rota || x.id === rota));
  const produtos = r.ordemMapa
    .map((nome) => cad.produtos.find((p) => p.nome === nome)!)
    .filter((p) => p && (r.entregaProduto[p.nome]?.pedidoSeg ?? 0) + (r.entregaProduto[p.nome]?.pedidoTer ?? 0) > 0.004);
  const env = (codigo: string, produto: string) => r.enviado[codigo]?.[produto] ?? 0;
  const ped = (codigo: string, produto: string) => sem.pedidoEscolas[codigo]?.[produto] ?? 0;
  return (
    <>
      {rotas.map((ro) => {
        const paradas = ro.paradas.filter((pa) => produtos.some((p) => env(pa.codigo, p.nome) > 0.0001));
        const totais = produtos.map((p) => paradas.reduce((t, pa) => t + env(pa.codigo, p.nome), 0));
        const peso = totais.reduce((a, b) => a + b, 0);
        const nomeDia = ro.titulo.split(" — ")[0];
        const veiculo = ro.titulo.match(/ROTA \d+\s*·\s*([^—·]+?)\s*—/i)?.[1] ?? "";
        const motorista = ro.titulo.match(/MOTORISTA\s+([^·]+)/i)?.[1]?.trim() ?? "";
        return (
          <div className="folha mapa-planilha" key={ro.id} data-arquivo={`mapa ${ro.id}`}>
            <div className="mapa-faixa">
              <p className="mapa-dia">{nomeDia}</p>
              <p className="mapa-rota">{ro.titulo}</p>
              {ro.saida && <p className="mapa-saida">{ro.saida}</p>}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>CÓD.</th>
                  <th>ESCOLA</th>
                  <th>BAIRRO</th>
                  {produtos.map((p) => (
                    <th key={p.nome} className="vertical">
                      <span>{p.nome}</span>
                    </th>
                  ))}
                  <th className="check" />
                </tr>
              </thead>
              <tbody>
                {paradas.map((pa, k) => (
                  <tr key={pa.codigo}>
                    <td className="c">{k + 1}</td>
                    <td className="c">{pa.codigo}</td>
                    <td>{pa.nomeMapa}</td>
                    <td className="bairro">{pa.bairro}</td>
                    {produtos.map((p) => {
                      const v = env(pa.codigo, p.nome);
                      const falta = v > 0.0001 && ped(pa.codigo, p.nome) - v > 0.005;
                      return (
                        <td key={p.nome} className={`valor${v > 0.0001 ? (falta ? " falta" : " vai") : ""}`}>
                          {v > 0.0001 ? kg2(v) : ""}
                        </td>
                      );
                    })}
                    <td className="check" />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total">
                  <td colSpan={4}>TOTAL DA ROTA (kg) →</td>
                  {totais.map((t, k) => (
                    <td key={produtos[k].nome} className="valor">
                      {t > 0.0001 ? kg2(t) : ""}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
            <div className="mapa-rodape">
              <span>
                <strong>Peso previsto:</strong> {kg2(peso)} kg
              </span>
              <span>
                <strong>Veículo:</strong> {veiculo}
              </span>
              <span>
                <strong>Motorista:</strong> {motorista}
              </span>
            </div>
            <p className="mapa-legenda">Amarelo = vai na caixa da escola · Laranja = escola recebe MENOS que o pedido (falta)</p>
          </div>
        );
      })}
      {!rota && <ConferenciaMapa cad={cad} sem={sem} r={r} />}
      {!rota && <Excedente dia={dia} ex={r.excedente[dia]} rotas={sem.rotas} unidade={(p) => cad.produtos.find((x) => x.nome === p)?.unidade ?? "kg"} impresso comLegumes={cad.excedenteLegumes} />}
    </>
  );
}

// "Conferência do mapa": o que chegou no galpão × o que sai nos caminhões (semana toda).
function ConferenciaMapa({ cad, sem, r }: P) {
  const [d1, d2] = ["1º DIA", "2º DIA"];
  const lancou2 = Object.values(sem.entrega2).some((x) => x && Object.keys(x).length);
  const linhas = r.ordemMapa
    .map((nome) => cad.produtos.find((p) => p.nome === nome)!)
    .filter((p) => p && (r.entregaProduto[p.nome]?.pedidoSeg ?? 0) + (r.entregaProduto[p.nome]?.pedidoTer ?? 0) > 0.004)
    .map((p) => {
      const e = r.entregaProduto[p.nome];
      const saiu = Object.values(r.enviado).reduce((t, x) => t + (x[p.nome] ?? 0), 0);
      const tem2 = e.planejado2 > 0.004 || e.entregue2 > 0.004;
      return { p, pedido: e.pedidoSeg + e.pedidoTer, c1: e.entregue1, c2: tem2 ? e.entregue2 : null, total: e.entregue1 + (tem2 ? e.entregue2 : 0), saiu };
    });
  const kgs = linhas.filter((l) => l.p.unidade === "kg");
  const soma = (f: (l: (typeof linhas)[number]) => number) => kgs.reduce((t, l) => t + f(l), 0);
  return (
    <div className="folha mapa-planilha">
      <div className="mapa-faixa">
        <p className="mapa-rota" style={{ fontSize: 15 }}>CONFERÊNCIA DO MAPA — o que chegou no galpão × o que sai nos caminhões</p>
      </div>
      <p style={{ fontStyle: "italic", fontSize: 10.5, color: "#333", margin: "6px 0 10px" }}>
        Chegou = 1º dia + 2º dia (entrega em branco conta o planejado). Saiu no mapa = soma de todas as rotas. SOBRA fica no galpão. FALTA = as escolas em laranja no mapa recebem
        menos que o pedido.
      </p>
      <table className="conferencia">
        <thead>
          <tr>
            <th>Nº</th>
            <th>PRODUTO</th>
            <th>PEDIDO DAS ESCOLAS</th>
            <th>CHEGOU {d1}</th>
            <th>
              CHEGOU {d2}
              {!lancou2 && <small>(previsto até lançar)</small>}
            </th>
            <th>CHEGOU TOTAL</th>
            <th>SAIU NO MAPA</th>
          </tr>
        </thead>
        <tbody>
          <tr className="total">
            <td colSpan={2} style={{ textAlign: "right" }}>
              TOTAL em kg (sem ovos) →
            </td>
            <td>{kg2(soma((l) => l.pedido))}</td>
            <td>{kg2(soma((l) => l.c1))}</td>
            <td>{kg2(soma((l) => l.c2 ?? 0))}</td>
            <td>{kg2(soma((l) => l.total))}</td>
            <td>{kg2(soma((l) => l.saiu))}</td>
          </tr>
          {linhas.map((l, k) => (
            <tr key={l.p.nome}>
              <td style={{ textAlign: "center" }}>{k + 1}</td>
              <td>
                <strong>{l.p.nome}</strong>
              </td>
              <td>{kg2(l.pedido)}</td>
              <td>{kg2(l.c1)}</td>
              <td>{l.c2 === null ? "–" : kg2(l.c2)}</td>
              <td>{kg2(l.total)}</td>
              <td>
                <strong>{kg2(l.saiu)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mapa-legenda">Amarelo = vai na caixa da escola · Laranja = escola recebe MENOS que o pedido (falta)</p>
    </div>
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
                    <td className="n">{kg2(x.entregue + (recusadoNoGalpao(sem, p.id).find((y) => y.produto === pr.nome)?.kg ?? 0))}</td>
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
            {recusadoNoGalpao(sem, p.id).length > 0 && (
              <p className="linha-cab" style={{ marginTop: 8 }}>
                <strong>Recusado no galpão (produto ruim, não pago):</strong> {recusadoNoGalpao(sem, p.id).map((x) => `${x.produto} ${kg2(x.kg)} kg`).join(" · ")}
              </p>
            )}
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

