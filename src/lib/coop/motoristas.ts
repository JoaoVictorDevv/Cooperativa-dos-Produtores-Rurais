// Motorista de cada rota (Rota 1 a 4, nos dois dias). Muda no Cadastro; o nome
// entra no título da rota (mapa, romaneios, retornos).
import type { Cadastro, Rota } from "./tipos";

// Como o João passou em 25/11/2026.
export const MOTORISTAS_PADRAO: Record<string, string> = { "1": "Jorge", "2": "Robson", "3": "Edu", "4": "Augusto" };

export function motoristasDe(cad: Cadastro): Record<string, string> {
  return { ...MOTORISTAS_PADRAO, ...(cad.motoristas ?? {}) };
}

export function tituloComMotorista(titulo: string, motoristas: Record<string, string>): string {
  const n = titulo.match(/ROTA\s+(\d+)/i)?.[1];
  const nome = n ? motoristas[n]?.trim() : "";
  if (!nome) return titulo;
  const NOME = nome.toUpperCase();
  if (/MOTORISTA\s+[^·]+/i.test(titulo)) return titulo.replace(/MOTORISTA\s+[^·]+?(\s*·|$)/i, `MOTORISTA ${NOME}$1`);
  return titulo.replace(/(ROTA\s+\d+[^·]*·[^·]+)/i, `$1 · MOTORISTA ${NOME}`);
}

export function rotasComMotorista<T extends Pick<Rota, "titulo">>(rotas: T[], cad: Cadastro): T[] {
  const m = motoristasDe(cad);
  return rotas.map((r) => ({ ...r, titulo: tituloComMotorista(r.titulo, m) }));
}
