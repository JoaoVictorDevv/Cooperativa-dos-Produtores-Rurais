// Lembretes da tela inicial: o que está atrasado ou perto do prazo, pelo
// calendário da semana (previsão até terça, galpão domingo/segunda, romaneios,
// conferência da Prefeitura, backup).

import type { ResultadoSemana } from "./motor";
import { listinha, somarDias, curta } from "./semana";
import type { Cadastro, Semana } from "./tipos";

export interface Lembrete {
  texto: string;
  link: string;
  nivel: "atrasado" | "hoje" | "aviso";
}

const dia = (d: string) => new Date(`${d}T12:00:00Z`);
const diasEntre = (a: string, b: string) => Math.round((dia(b).getTime() - dia(a).getTime()) / 86400000);

export function lembretes(
  cad: Cadastro,
  semanas: { s: Semana; r: ResultadoSemana }[],
  previsoes: string[],
  hoje: string,
  ultimoBackup: string | null,
): Lembrete[] {
  const out: Lembrete[] = [];
  const ordenadas = [...semanas].sort((a, b) => a.s.data.localeCompare(b.s.data));
  const ultima = ordenadas.at(-1);

  // Previsão da entrega seguinte: a nutrição precisa até terça.
  if (ultima) {
    const proxima = somarDias(ultima.s.data, 7);
    const temPrevisao = previsoes.some((p) => Math.abs(diasEntre(p, proxima)) <= 1);
    const faltam = diasEntre(hoje, proxima);
    if (!temPrevisao && faltam <= 6 && faltam >= -1) {
      out.push({
        texto: `Previsão da entrega de ${curta(proxima)} ainda não foi gravada (a nutrição precisa até terça).`,
        link: `/coop/previsao?data=${proxima}`,
        nivel: faltam <= 4 ? "atrasado" : "aviso",
      });
    }
  }

  for (const { s, r } of ordenadas) {
    const base = `/coop/semana/${s.data}`;
    const itens = listinha(cad, s, r);
    const item = (chave: string) => itens.find((i) => i.chave === chave)!;
    const passou = diasEntre(s.data, hoje); // dias desde a referência (domingo/segunda da entrega)
    if (passou < -7 || passou > 60) continue;
    const ref = curta(s.referencia.split("/").reverse().join("-"));
    if (!item("mensagens").feito && passou >= -5) out.push({ texto: `Semana ${ref}: pedido ainda não foi enviado a todos os produtores (${item("mensagens").detalhe}).`, link: `${base}/pedido`, nivel: passou >= -2 ? "atrasado" : "aviso" });
    if (!item("dia1").feito && passou >= 0) out.push({ texto: `Semana ${ref}: lançar o galpão de ${s.diasGalpao[0].toLowerCase()} (${item("dia1").detalhe}).`, link: `${base}/galpao/1`, nivel: passou === 0 ? "hoje" : "atrasado" });
    if (!item("dia2").feito && passou >= 1) out.push({ texto: `Semana ${ref}: lançar o galpão de ${s.diasGalpao[1].toLowerCase()} (${item("dia2").detalhe}).`, link: `${base}/galpao/2`, nivel: passou === 1 ? "hoje" : "atrasado" });
    if (item("dia2").feito && !s.romaneiosConferidos && passou >= 3) out.push({ texto: `Semana ${ref}: romaneios das escolas ainda não conferidos.`, link: `${base}/retornos`, nivel: passou >= 7 ? "atrasado" : "aviso" });
    if (s.romaneiosConferidos && !Object.keys(s.conferidoPrefeitura).length && passou >= 10) out.push({ texto: `Semana ${ref}: a conferência da Prefeitura ainda não chegou. Cobrar por e-mail.`, link: `${base}/fechamento`, nivel: "aviso" });
    if (!item("custos").feito && passou >= 3) out.push({ texto: `Semana ${ref}: custos da semana não lançados.`, link: `${base}/fechamento`, nivel: "aviso" });
  }

  if (!ultimoBackup || diasEntre(ultimoBackup, hoje) >= 7) {
    out.push({ texto: ultimoBackup ? `Último backup foi em ${curta(ultimoBackup)}. Baixe um novo.` : "Nenhum backup ainda. Baixe um e guarde no pendrive.", link: "/coop/backup", nivel: "aviso" });
  }
  const peso = { atrasado: 0, hoje: 1, aviso: 2 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]).slice(0, 8);
}
