// Mensagens de WhatsApp para os produtores — o mesmo texto da planilha
// (aba de cada produtor, A28). A pergunta da previsão é outra mensagem.
// O que vai na mensagem é o que vale para pagar.

import type { ResultadoSemana } from "./motor";
import { kgMensagem } from "./numeros";
import type { Cadastro, Produtor, Semana } from "./tipos";

export interface Mensagem {
  produtor: Produtor;
  temPedido: boolean;
  texto: string;
  link: string | null; // https://wa.me/55...?text=...
}

const artigo = (dia: string) => (/^(DOMINGO|SÁBADO|SABADO)$/i.test(dia.trim()) ? "no" : "na");

export function telefoneWhatsApp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const n = telefoneWhatsApp(telefone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

export function textoPedido(cad: Cadastro, sem: Semana, r: ResultadoSemana, produtor: Produtor): string | null {
  const itens = cad.produtos.map((p) => ({ p, x: r.produtores[produtor.id][p.nome] }));
  if (itens.every(({ x }) => x.pedido === 0)) return null;
  const linhas = [`Olá, ${produtor.curto}! 🌱`, `Pedido da Cooperativa — semana ${sem.referencia}${sem.entrega ? ` (entrega ${sem.entrega})` : ""}:`];
  const [dia1, dia2] = sem.diasGalpao;
  const dia = (titulo: string, campo: "planejado1" | "planejado2") => {
    const doDia = itens.filter(({ x }) => x[campo] > 0.004);
    if (!doDia.length) return;
    linhas.push(`*Entregar ${artigo(titulo)} ${titulo.toUpperCase()}:*`);
    for (const { p, x } of doDia) linhas.push(`• ${p.nome}: ${kgMensagem(x[campo])} ${p.unidade}`);
  };
  dia(dia1, "planejado1");
  dia(dia2, "planejado2");
  linhas.push("Qualquer problema, avise antes. Obrigado!");
  return linhas.join("\n");
}

// 04/11/2026: a mensagem do pedido vai SEM a pergunta da próxima (para não
// confundir). A previsão é perguntada separado, depois da entrega (tela Previsão).
export function mensagensDaSemana(cad: Cadastro, sem: Semana, r: ResultadoSemana): Mensagem[] {
  return cad.produtores.flatMap((produtor) => {
    const texto = textoPedido(cad, sem, r, produtor);
    return texto ? [{ produtor, temPedido: true, texto, link: linkWhatsApp(produtor.telefone, texto) }] : [];
  });
}

export function perguntaPrevisao(produtor: Pick<Produtor, "curto">, entrega: string, dias: string, prazo: string): string {
  return `Bom dia, ${produtor.curto}! O que você vai ter pra entrega de ${entrega}${dias.trim() ? ` (${dias})` : ""}? Me fala o produto e quantos kg. Precisamos passar essa previsão pra nutrição${prazo.trim() ? ` até ${prazo}` : ""}. Obrigado!`;
}
