// Executor dos testes de integração com banco DESCARTÁVEL (specs/001, adendo
// 2026-09). Cria um banco novo, com nome único, no servidor indicado em
// .env.test (o banco citado lá NÃO é usado nem tocado), marca-o com um
// código aleatório desta execução, aplica as migrações existentes, roda os
// testes e apaga o banco no fim — mesmo se os testes falharem.
//
// Uso: npm run test:integration
// Servidor não local só com COLHEITA_TEST_ALLOW_REMOTE=1 (e nunca produção).
// Nenhuma mensagem imprime a URL (pode conter senha).

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env.test"), override: true, quiet: true });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const serverUrl = process.env.TEST_DATABASE_SERVER_URL ?? process.env.DATABASE_URL;
if (!serverUrl) {
  console.error("Defina DATABASE_URL em .env.test (apenas para indicar o servidor Postgres de testes).");
  process.exit(2);
}
let base;
try {
  base = new URL(serverUrl);
} catch {
  console.error("URL do servidor de testes ilegível em .env.test.");
  process.exit(2);
}
if (!LOCAL_HOSTS.has(base.hostname) && process.env.COLHEITA_TEST_ALLOW_REMOTE !== "1") {
  console.error(`Servidor "${base.hostname}" não é local. Testes destrutivos só em servidor local (ou COLHEITA_TEST_ALLOW_REMOTE=1).`);
  process.exit(2);
}

const token = randomBytes(16).toString("hex");
const dbName = `colheita_descartavel_${Date.now()}_${randomBytes(3).toString("hex")}`;
if (!/^colheita_descartavel_[a-z0-9_]{6,60}$/.test(dbName)) throw new Error("nome gerado inválido");

const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const targetUrl = new URL(base);
targetUrl.pathname = `/${dbName}`;

const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const childEnv = { ...process.env, DATABASE_URL: targetUrl.toString(), COLHEITA_TEST_DB_TOKEN: token };

let status = 1;
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  created = true;
  await admin.$executeRawUnsafe(`COMMENT ON DATABASE "${dbName}" IS 'colheita:descartavel:${token}'`);
  console.log(`Banco descartável criado: ${dbName} em ${base.hostname}`);

  const migrate = spawnSync(npx, ["prisma", "migrate", "deploy"], { env: childEnv, stdio: "inherit", shell: process.platform === "win32" });
  if (migrate.status !== 0) throw new Error("Falha ao aplicar as migrações no banco descartável.");

  const tests = spawnSync(npx, ["vitest", "run", "src/lib/pnae.integration.test.ts"], { env: childEnv, stdio: "inherit", shell: process.platform === "win32" });
  status = tests.status ?? 1;
} catch (err) {
  console.error(err instanceof Error ? err.message : "Erro no executor de testes de integração.");
} finally {
  if (created) {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    console.log(`Banco descartável apagado: ${dbName}`);
  }
  await admin.$disconnect();
}
process.exit(status);
