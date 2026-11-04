import { textoPedido } from "@/lib/coop/mensagens";
import { referenciaDeData, somarDias, curta } from "@/lib/coop/semana";
import { carregarSemana } from "../../../dados";
import { Divisao, type LinhaDivisao } from "./Divisao";
import { Mensagens } from "./Mensagens";

export const metadata = { title: "Pedido e mensagens" };

const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const nomeDia = (d: string) => NOME_DIA[new Date(`${d}T12:00:00Z`).getUTCDay()];

export default async function Pedido({ params }: PageProps<"/coop/semana/[data]/pedido">) {
  const { data } = await params;
  const { cad, sem, r } = await carregarSemana(data);
  const mes = r.mesIndice;

  const linhas: LinhaDivisao[] = cad.produtos
    .map((p) => {
      const total = cad.produtores.reduce((s, pr) => s + (r.pedidoProdutor[pr.id][p.nome] ?? 0), 0) + (r.faltaNaDivisao[p.nome] ?? 0);
      const pedido = r.resumo.produtos.find((x) => x.produto === p.nome)?.pedido ?? total;
      return {
        produto: p.nome,
        unidade: p.unidade,
        pedido,
        falta: r.faltaNaDivisao[p.nome] ?? 0,
        produtores: cad.produtores
          .map((pr) => ({
            id: pr.id,
            nome: pr.curto,
            capacidadeMes: mes === 0 ? 0 : (cad.capacidade[p.nome]?.[pr.id]?.[mes - 1] ?? 0),
            capacidadeSemana: sem.capacidadeSemana[p.nome]?.[pr.id] ?? null,
            calculado: r.divisaoCalculada[pr.id][p.nome] ?? 0,
            manual: sem.pedidoProdutorManual[pr.id]?.[p.nome] ?? null,
            final: r.pedidoProdutor[pr.id][p.nome] ?? 0,
          }))
          .filter((x) => x.capacidadeMes > 0 || x.capacidadeSemana !== null || x.final > 0 || x.manual !== null),
      };
    })
    .filter((l) => l.pedido > 0);

  // Próxima entrega: a semana seguinte, com os dias do galpão.
  const proxRef = somarDias(sem.data, 7);
  const galpao = sem.diasGalpao[0] === "DOMINGO" ? [somarDias(proxRef, -1), proxRef] : [proxRef, somarDias(proxRef, 1)];
  const sugestao = {
    proxima: curta(proxRef),
    diasProxima: `${nomeDia(galpao[0])} ${curta(galpao[0])} e ${nomeDia(galpao[1])} ${curta(galpao[1])}`,
    prazo: `quarta ${curta(somarDias(sem.data, 2))}`,
  };
  const msgs = cad.produtores.map((p) => ({
    id: p.id,
    nome: p.nome,
    curto: p.curto,
    telefone: p.telefone,
    pedido: textoPedido(cad, sem, r, p),
    enviadaEm: sem.mensagensEnviadas?.[p.id] ?? null,
  }));

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Divisão entre os produtores</h2>
      <p className="discreto">
        Igual à planilha: divide pelo Mapa de Produção do mês ({referenciaDeData(sem.data).slice(3)}). Para mudar, digite no amarelo: <strong>Só esta semana</strong> (o
        produtor avisou que tem outra quantidade) ou <strong>Ajuste</strong> (o pedido dele fica fixo nesse número). Apagar = volta ao automático.
      </p>
      <Divisao data={sem.data} linhas={linhas} />
      <h2>Mensagens para os produtores</h2>
      <Mensagens data={sem.data} itens={msgs} sugestao={sugestao} />
    </>
  );
}
