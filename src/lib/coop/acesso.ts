// Acesso pelo celular: o app abre na rede da casa/galpão, então pede um PIN.
// - O PIN e um segredo aleatório ficam em dados-cooperativa/acesso.json.
// - Quem acerta o PIN ganha um cookie (vale 1 ano) = sha256 do segredo.
// - No próprio PC, o atalho abre /entrar?chave=... (chave nova a cada vez que o
//   app abre, guardada em .next/coop-chave): entra sem digitar o PIN.
// Sem dependências do Next: usado pelo proxy e pelas ações.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const COOKIE_ACESSO = "coop_acesso";
export const PIN_PADRAO = "1234";

interface Acesso {
  pin: string;
  segredo: string;
}

const arquivo = () => path.join(path.resolve(process.env.COOP_DADOS || path.join(process.cwd(), "dados-cooperativa")), "acesso.json");

export async function lerAcesso(criar = false): Promise<Acesso | null> {
  try {
    return JSON.parse(await fs.readFile(arquivo(), "utf8")) as Acesso;
  } catch {
    if (!criar) return null;
    const novo: Acesso = { pin: PIN_PADRAO, segredo: randomBytes(32).toString("hex") };
    await fs.mkdir(path.dirname(arquivo()), { recursive: true });
    await fs.writeFile(arquivo(), JSON.stringify(novo, null, 1), "utf8");
    return novo;
  }
}

export async function gravarPin(pin: string) {
  const a = (await lerAcesso(true))!;
  // Trocar o PIN derruba quem já tinha entrado (segredo novo).
  await fs.writeFile(arquivo(), JSON.stringify({ pin, segredo: randomBytes(32).toString("hex") }, null, 1), "utf8");
  return a;
}

export const valorCookie = (segredo: string) => createHash("sha256").update(`coop:${segredo}`).digest("hex");

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function chaveLocal(): Promise<string | null> {
  try {
    return (await fs.readFile(path.join(process.cwd(), ".next", "coop-chave"), "utf8")).trim() || null;
  } catch {
    return null;
  }
}
