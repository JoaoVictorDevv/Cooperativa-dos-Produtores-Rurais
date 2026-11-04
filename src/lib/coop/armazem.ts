import "server-only";

// Onde o app guarda os dados: arquivos JSON numa pasta do computador.
//   dados-cooperativa/cadastro.json
//   dados-cooperativa/semanas/2026-11-08.json
//   dados-cooperativa/previsoes/2026-11-08.json
// A pasta fica fora do Git (tem nomes, telefones e valores reais).
// COOP_DADOS=... muda o lugar.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Cadastro, Semana } from "./tipos";
import type { Previsao } from "./previsao";

export function pastaDados(): string {
  return path.resolve(process.env.COOP_DADOS || path.join(process.cwd(), "dados-cooperativa"));
}

// O app da Cooperativa ainda não tem login: só funciona no próprio
// computador (npm run coop). Fora disso, não abre.
export function modoLocal(): boolean {
  return process.env.COOP_LOCAL === "1";
}

export function garantirLocal() {
  if (!modoLocal()) throw new Error("O app da Cooperativa só abre no computador local (npm run coop).");
}

async function lerJson<T>(arquivo: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(arquivo, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// Grava em arquivo temporário e troca: se faltar luz no meio, não corrompe.
async function gravarJson(arquivo: string, dados: unknown) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dados, null, 1), "utf8");
  await fs.rename(tmp, arquivo);
}

const dataValida = (data: string) => /^\d{4}-\d{2}-\d{2}$/.test(data);

export async function lerCadastro(): Promise<Cadastro | null> {
  garantirLocal();
  return lerJson<Cadastro>(path.join(pastaDados(), "cadastro.json"));
}

export async function gravarCadastro(c: Cadastro) {
  garantirLocal();
  await gravarJson(path.join(pastaDados(), "cadastro.json"), c);
}

export async function listarSemanas(): Promise<string[]> {
  garantirLocal();
  try {
    const nomes = await fs.readdir(path.join(pastaDados(), "semanas"));
    return nomes.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort().reverse();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function lerSemana(data: string): Promise<Semana | null> {
  garantirLocal();
  if (!dataValida(data)) return null;
  return lerJson<Semana>(path.join(pastaDados(), "semanas", `${data}.json`));
}

export async function gravarSemana(s: Semana) {
  garantirLocal();
  if (!dataValida(s.data)) throw new Error("Data da semana inválida.");
  // Guarda a versão anterior (desfazer manual, se precisar).
  const arquivo = path.join(pastaDados(), "semanas", `${s.data}.json`);
  const anterior = await lerJson<Semana>(arquivo);
  if (anterior) await gravarJson(path.join(pastaDados(), "historico", `${s.data}-${Date.now()}.json`), anterior);
  await gravarJson(arquivo, { ...s, atualizadoEm: new Date().toISOString() });
}

export async function lerPrevisao(data: string): Promise<Previsao | null> {
  garantirLocal();
  if (!dataValida(data)) return null;
  return lerJson<Previsao>(path.join(pastaDados(), "previsoes", `${data}.json`));
}

export async function gravarPrevisao(p: Previsao) {
  garantirLocal();
  if (!dataValida(p.data)) throw new Error("Data da previsão inválida.");
  await gravarJson(path.join(pastaDados(), "previsoes", `${p.data}.json`), p);
}

export async function listarPrevisoes(): Promise<string[]> {
  garantirLocal();
  try {
    const nomes = await fs.readdir(path.join(pastaDados(), "previsoes"));
    return nomes.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort().reverse();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
