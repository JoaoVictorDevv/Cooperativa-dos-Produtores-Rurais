// Escala do galpão: quem trabalha em cada dia, a hora e a diária.
// A diária fica só no app (não sai na folha da equipe) e dá o custo de montagem.
import type { Cadastro, EscalaGalpao } from "./tipos";
import { semAcento } from "./texto";

// Como na folha "Equipe do galpão" (25/11/2026). Vale até o João mudar no Cadastro.
export const ESCALA_PADRAO: EscalaGalpao = {
  diaria: 150,
  tarefasChefe: [
    "Organizar o galpão",
    "Receber a entrega dos produtores",
    "Montar as entregas",
    "Organizar a saída dos caminhões e receber na volta",
    "Receber os romaneios quando os caminhões voltam",
    "Arrumar o galpão",
  ],
  dias: [
    { dia: "Domingo", pessoas: [{ nome: "Clodomir", funcao: "chefe", hora: "9h" }, { nome: "Tata", funcao: "ajudante", hora: "9h" }, { nome: "Caique", funcao: "ajudante", hora: "9h" }] },
    { dia: "Segunda", pessoas: [{ nome: "Clodomir", funcao: "chefe", hora: "6h" }, { nome: "Maxuel", funcao: "ajudante", hora: "9h" }, { nome: "Caique", funcao: "ajudante", hora: "9h" }] },
    { dia: "Terça", pessoas: [{ nome: "Clodomir", funcao: "chefe", hora: "6h" }] },
  ],
};

export function escalaDe(cad: Cadastro): EscalaGalpao {
  return cad.escala ?? ESCALA_PADRAO;
}

export function diariasDaEscala(e: EscalaGalpao): number {
  return e.dias.reduce((s, d) => s + d.pessoas.filter((p) => p.nome.trim()).length, 0);
}

export function custoDaEscala(e: EscalaGalpao): number {
  return diariasDaEscala(e) * e.diaria;
}

// "DOMINGO" (dia do galpão na semana) → dia da escala.
export function diaDaEscala(e: EscalaGalpao, nomeDia: string) {
  const alvo = semAcento(nomeDia).replace(/-feira/, "").trim();
  return e.dias.find((d) => semAcento(d.dia).replace(/-feira/, "").trim() === alvo) ?? null;
}

// "Tata e Caique", "A, B e C"
export function juntarNomes(nomes: string[]): string {
  return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

// Agrupa por função e hora: [{ funcao, hora, nomes }]
export function gruposDoDia(pessoas: EscalaGalpao["dias"][number]["pessoas"]) {
  const grupos: { funcao: "chefe" | "ajudante"; hora: string; nomes: string[] }[] = [];
  for (const p of pessoas.filter((x) => x.nome.trim())) {
    const g = grupos.find((x) => x.funcao === p.funcao && x.hora === p.hora);
    if (g) g.nomes.push(p.nome);
    else grupos.push({ funcao: p.funcao, hora: p.hora, nomes: [p.nome] });
  }
  return grupos.sort((a, b) => (a.funcao === b.funcao ? 0 : a.funcao === "chefe" ? -1 : 1));
}
