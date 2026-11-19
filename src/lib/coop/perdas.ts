// Perdas da semana = o que a Prefeitura não pagou (valor de venda), explicado
// escola por escola: de onde veio cada quilo.
//
// Para cada escola e produto: pedido − cobrado. Separado pela causa:
//   1. Escola sem receber   — a escola não recebeu nada (fechada, não faz almoço…)
//   2. Devolvido pela escola — recusou na hora (com o motivo do romaneio)
//   3. Não foi / foi a menos — o mapa mandou menos ou a escola recebeu menos
// Quando a Prefeitura manda a conferência, ela pode pagar um pouco diferente do
// que as escolas aceitaram: essa diferença aparece numa linha à parte.

import type { ResultadoSemana } from "./motor";
import type { Cadastro, Semana } from "./tipos";

export type CausaPerda = "semReceber" | "devolvido" | "aMenos";

export const NOME_CAUSA: Record<CausaPerda, string> = {
  semReceber: "Escola sem receber",
  devolvido: "Devolvido pela escola",
  aMenos: "Não foi / foi a menos",
};

export interface ItemPerda {
  causa: CausaPerda;
  codigo: string;
  escola: string;
  produto: string;
  kg: number;
  valor: number;
  detalhe: string; // motivo, situação, "fechada"…
}

export interface LinhaPerda {
  causa: CausaPerda;
  titulo: string; // "Couve manteiga — 1109, 2019 e 1080" ou "3022 CEI Deise Eloy Gomes — escola fechada"
  kg: number;
  valor: number;
  itens: ItemPerda[];
}

export interface PerdasSemana {
  linhas: LinhaPerda[];
  porCausa: { causa: CausaPerda; kg: number; valor: number }[];
  escolas: { kg: number; valor: number }; // soma escola por escola
  ajusteConferencia: number; // R$: conferência da Prefeitura − soma das escolas (0 sem conferência)
  total: number; // o que a Prefeitura não pagou (por produto, com a conferência)
  pedidoValor: number;
  entreguePct: number; // % do pedido (em R$) que a Prefeitura pagou
}

const lista = (cods: string[]) => (cods.length <= 1 ? cods.join("") : `${cods.slice(0, -1).join(", ")} e ${cods.at(-1)}`);

export function perdasDaSemana(cad: Cadastro, sem: Semana, r: ResultadoSemana): PerdasSemana {
  const preco = Object.fromEntries(cad.produtos.map((p) => [p.nome, p.preco]));
  const escolas = new Map(cad.escolas.map((e) => [e.codigo, e]));
  const motivo = new Map(cad.motivos.map((m) => [m.codigo, m.texto]));
  const itens: ItemPerda[] = [];

  for (const [codigo, fichas] of Object.entries(r.fichas)) {
    const comPedido = Object.entries(fichas).filter(([, f]) => f.pedido > 0);
    if (!comPedido.length) continue;
    const nada = comPedido.every(([, f]) => f.bruto === 0);
    const e = escolas.get(codigo);
    const nome = e?.nome ?? codigo;
    for (const [produto, f] of comPedido) {
      const kg = f.pedido - f.cobrado;
      if (kg < 0.005) continue;
      let causa: CausaPerda;
      let detalhe = "";
      if (nada) {
        causa = "semReceber";
        detalhe =
          cad.excecoesEscolas?.[codigo]?.motivo ||
          sem.reentregas?.[codigo]?.motivo?.toLowerCase() ||
          (f.situacao ? "não recebeu" : "não recebeu");
      } else if (f.rejeitado > 0.004) {
        causa = "devolvido";
        detalhe = f.motivo ? (motivo.get(f.motivo) ?? f.motivo) : "recusado";
      } else {
        causa = "aMenos";
        detalhe = f.motivo ? (motivo.get(f.motivo) ?? f.motivo) : "";
      }
      itens.push({ causa, codigo, escola: nome, produto, kg, valor: kg * (preco[produto] ?? 0), detalhe });
    }
  }

  // Linhas como no relatório: escola sem receber = uma linha por escola;
  // o resto = uma linha por produto (e motivo) com os códigos das escolas.
  const linhas: LinhaPerda[] = [];
  const ordemCausa: CausaPerda[] = ["devolvido", "semReceber", "aMenos"];
  for (const causa of ordemCausa) {
    const daCausa = itens.filter((i) => i.causa === causa);
    const grupos = new Map<string, ItemPerda[]>();
    for (const i of daCausa) {
      const chave = causa === "semReceber" ? i.codigo : `${i.produto}|${i.detalhe}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), i]);
    }
    const daCausaLinhas: LinhaPerda[] = [...grupos.values()].map((g) => {
      const kg = g.reduce((s, i) => s + i.kg, 0);
      const valor = g.reduce((s, i) => s + i.valor, 0);
      const titulo =
        causa === "semReceber"
          ? `${g[0].codigo} ${g[0].escola}${g[0].detalhe ? ` — ${g[0].detalhe}` : ""}`
          : `${g[0].produto}${g[0].detalhe ? ` (${g[0].detalhe.toLowerCase()})` : ""} — ${lista(g.map((i) => i.codigo))}`;
      return { causa, titulo, kg, valor, itens: g };
    });
    linhas.push(...daCausaLinhas.sort((a, b) => b.valor - a.valor));
  }

  const porCausa = ordemCausa
    .map((causa) => ({ causa, kg: itens.filter((i) => i.causa === causa).reduce((s, i) => s + i.kg, 0), valor: itens.filter((i) => i.causa === causa).reduce((s, i) => s + i.valor, 0) }))
    .filter((c) => c.kg > 0.004);
  const somaEscolas = { kg: itens.reduce((s, i) => s + i.kg, 0), valor: itens.reduce((s, i) => s + i.valor, 0) };
  const pedidoValor = r.resumo.produtos.reduce((s, p) => s + p.pedido * (preco[p.produto] ?? 0), 0);
  // Total = por produto (é o que vai na cobrança; com a conferência, o que a Prefeitura conferiu).
  const total = r.resumo.entregasLancadasKg > 0 ? r.resumo.produtos.reduce((s, p) => s + p.naoCobradoValor, 0) : 0;
  const ajuste = total - somaEscolas.valor;
  return {
    linhas,
    porCausa,
    escolas: somaEscolas,
    ajusteConferencia: Math.abs(ajuste) >= 0.5 ? ajuste : 0,
    total,
    pedidoValor,
    entreguePct: pedidoValor > 0 ? (1 - total / pedidoValor) * 100 : 0,
  };
}
