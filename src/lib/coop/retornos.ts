// Atalho dos retornos: o João escreve do jeito que fala, uma linha por escola.
//   "1005 não veio cheiro verde"
//   "1021 recusou alface 2kg"        (rejeitado 2 kg)
//   "1021 devolveu couve"            (rejeitado tudo que chegou)
//   "2018 alface veio 1,5"           (recebido 1,5 kg)
//   "1081 não recebeu nada"          (nada chegou)
// O que não for citado fica como chegou (= o que saiu no caminhão).

import { produtoDoTexto } from "./previsao";
import type { RetornoEscola } from "./tipos";

export interface MudancaRetorno {
  codigo: string;
  produto: string;
  retorno: RetornoEscola;
  explicacao: string;
}

export interface LeituraRetornos {
  mudancas: MudancaRetorno[];
  naoEntendi: string[];
}

const semAcento = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const numero = (t: string) => {
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

export function lerRetornos(
  texto: string,
  escolas: { codigo: string; nome: string }[],
  produtos: string[],
  enviado: (codigo: string, produto: string) => number,
): LeituraRetornos {
  const res: LeituraRetornos = { mudancas: [], naoEntendi: [] };
  const porCodigo = new Map(escolas.map((e) => [e.codigo, e]));
  for (const bruta of texto.split(/\n+/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = linha.match(/^(\d{3,5}(?:\.\d+)?)\b\s*[-:,]?\s*(.*)$/);
    const escola = m ? porCodigo.get(m[1]) : undefined;
    if (!m || !escola) {
      res.naoEntendi.push(`${linha} (comece com o código da escola)`);
      continue;
    }
    const resto = semAcento(m[2]);
    const recebidos = produtos.filter((p) => enviado(escola.codigo, p) > 0.0001);
    if (/nao (veio|recebeu|chegou|entregou|entregue) nada|nada (chegou|veio)|nao foi entregue|escola fechada|fechad[ao]/.test(resto) && !produtoDoTexto(resto, produtos)) {
      for (const p of recebidos) res.mudancas.push({ codigo: escola.codigo, produto: p, retorno: { recebido: 0 }, explicacao: `${escola.nome}: ${p} não chegou` });
      if (!recebidos.length) res.naoEntendi.push(`${linha} (essa escola não tem nada no mapa)`);
      continue;
    }
    // Pode ter mais de um produto: "1005 não veio cheiro verde, alface recusou 2kg"
    let entendeu = false;
    for (const parte of m[2].split(/(?<!\d),(?!\d)|;| e (?=n[aã]o|recus|devolv|rejeit|falt)/i)) {
      const t = semAcento(parte);
      const produto = produtoDoTexto(t, produtos);
      if (!produto) continue;
      const env = enviado(escola.codigo, produto);
      const kg = numero(t);
      let retorno: RetornoEscola | null = null;
      let explicacao = "";
      if (/nao (veio|recebeu|chegou|entregou)|faltou|sem /.test(t)) {
        retorno = { recebido: 0 };
        explicacao = `${produto} não chegou`;
      } else if (/recus|devolv|rejeit|voltou/.test(t)) {
        const rej = kg === null ? env : Math.min(kg, env);
        retorno = { rejeitado: rej };
        explicacao = `${produto}: recusou ${String(rej).replace(".", ",")} kg`;
      } else if (kg !== null) {
        retorno = { recebido: kg };
        explicacao = `${produto}: chegou ${String(kg).replace(".", ",")} kg`;
      }
      if (!retorno) continue;
      entendeu = true;
      res.mudancas.push({ codigo: escola.codigo, produto, retorno, explicacao: `${escola.nome}: ${explicacao}` });
    }
    if (!entendeu) res.naoEntendi.push(linha);
  }
  return res;
}
