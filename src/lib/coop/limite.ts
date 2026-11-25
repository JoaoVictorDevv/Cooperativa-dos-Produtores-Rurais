// Limite de R$ 40 mil por produtor no ano (Chamada Pública). Só informação:
// o app não trava, não corta e não reduz pedido nenhum.
//
// Conta pelo VALOR DE VENDA (o que a Prefeitura paga pelo produto do produtor):
//  - semana com entrega lançada: o que foi pago (aceito, até o pedido) × preço de venda;
//  - semana ainda sem entrega: o pedido × preço de venda (previsto).
// O que o produtor trouxe a mais que o pedido não é pago, então não conta.
import { lerSemana, listarSemanas } from "./armazem";
import { calcularSemana } from "./motor";
import type { Cadastro } from "./tipos";

export const LIMITE_ANO = 40000;

export interface LinhaLimite {
  id: string;
  nome: string;
  curto: string;
  vendido: number; // semanas com entrega
  previsto: number; // pedidos de semanas ainda sem entrega
  total: number;
}

export async function limitePorProdutor(cad: Cadastro, ate?: string) {
  const datas = (await listarSemanas()).filter((d) => !ate || d <= ate).sort();
  const ano = (ate ?? datas.at(-1) ?? "").slice(0, 4);
  const preco = Object.fromEntries(cad.produtos.map((p) => [p.nome, p.preco]));
  const linhas = new Map<string, LinhaLimite>(cad.produtores.map((p) => [p.id, { id: p.id, nome: p.nome, curto: p.curto, vendido: 0, previsto: 0, total: 0 }]));
  const semanasPrevistas: string[] = [];
  let primeira = "";
  for (const d of datas) {
    if (d.slice(0, 4) !== ano) continue;
    const s = await lerSemana(d);
    if (!s) continue;
    const r = calcularSemana(cad, s);
    const comEntrega = r.resumo.entregasLancadasKg > 0;
    if (!comEntrega) semanasPrevistas.push(s.referencia.slice(0, 5));
    primeira ||= s.referencia.slice(0, 5);
    for (const [id, itens] of Object.entries(r.produtores)) {
      const l = linhas.get(id);
      if (!l) continue;
      for (const [produto, x] of Object.entries(itens)) {
        if (comEntrega) l.vendido += x.pagoKg * (preco[produto] ?? 0);
        else l.previsto += x.pedido * (preco[produto] ?? 0);
      }
    }
  }
  const lista = [...linhas.values()]
    .map((l) => ({ ...l, vendido: Math.round(l.vendido * 100) / 100, previsto: Math.round(l.previsto * 100) / 100, total: Math.round((l.vendido + l.previsto) * 100) / 100 }))
    .filter((l) => l.total > 0.004)
    .sort((a, b) => b.total - a.total);
  return { ano, primeira, ultima: datas.at(-1) ?? "", semanasPrevistas, linhas: lista };
}
