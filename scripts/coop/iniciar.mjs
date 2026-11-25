// Abre o app da Cooperativa no computador.
//   node scripts/coop/iniciar.mjs            -> modo desenvolvimento (npm run coop:dev)
//   node scripts/coop/iniciar.mjs producao   -> modo final (abrir-app.bat ou npm run coop)
//
// Liga o modo local (dados em ./dados-cooperativa) e inicia o Next.
// Abre também na rede (Wi-Fi) para o celular: lá o app pede o PIN (Cadastro → Celular).
// Neste PC o navegador entra direto, com uma chave nova a cada vez que o app abre.
//
// No modo final:
// - se o app ainda não foi preparado, ou se os arquivos mudaram depois de uma
//   atualização (Pull no GitHub Desktop), prepara de novo sozinho;
// - se o app já está aberto, só abre o navegador;
// - abre o navegador quando o app estiver pronto (COOP_ABRIR=0 para não abrir).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Funciona com espaço e acento no caminho (ex.: "Área de Trabalho").
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(raiz);

const porta = process.env.PORT || "3000";
const url = `http://localhost:${porta}/coop`;
const producao = process.argv[2] === "producao";
const env = { ...process.env, COOP_LOCAL: "1", NEXT_TELEMETRY_DISABLED: "1" };
const nextBin = createRequire(path.join(raiz, "package.json")).resolve("next/dist/bin/next");

// Chave para este PC entrar sem PIN (o app confere em /entrar?chave=...).
const arquivoChave = path.join(raiz, ".next", "coop-chave");
function chave() {
  if (existsSync(arquivoChave)) return readFileSync(arquivoChave, "utf8").trim();
  return novaChave();
}
function novaChave() {
  mkdirSync(path.dirname(arquivoChave), { recursive: true });
  const c = randomBytes(24).toString("hex");
  writeFileSync(arquivoChave, c);
  return c;
}

// Endereços deste PC na rede (para digitar no celular).
function enderecosNaRede() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${porta}/coop`);
}

function abrirNavegador() {
  if (process.env.COOP_ABRIR === "0") return;
  const url = `http://localhost:${porta}/entrar?chave=${chave()}`;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // sem navegador automático: o endereço está escrito na janela
  }
}

async function respondendo() {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/coop`, { signal: AbortSignal.timeout(1500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

// "Versão" dos arquivos do app: muda quando algo em src/, public/ ou package.json muda.
function versaoDosArquivos() {
  let maior = 0;
  let quantos = 0;
  const olhar = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) olhar(p);
      else {
        quantos++;
        maior = Math.max(maior, statSync(p).mtimeMs);
      }
    }
  };
  olhar(path.join(raiz, "src"));
  olhar(path.join(raiz, "public"));
  for (const f of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json"]) if (existsSync(f)) maior = Math.max(maior, statSync(f).mtimeMs);
  return `${Math.round(maior)}-${quantos}`;
}

// Depois de atualizar (Pull), pode ter peça nova no package.json: instala o que faltar.
function instalarSeFaltar() {
  const pkg = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
  const faltam = Object.keys(pkg.dependencies ?? {}).filter((d) => !existsSync(path.join(raiz, "node_modules", d, "package.json")));
  if (!faltam.length) return true;
  console.log(`\nInstalando peça nova da atualização (${faltam.join(", ")}). Leva 1 ou 2 minutos, não feche a janela...\n`);
  const r = spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { stdio: "inherit", cwd: raiz, shell: true });
  if (r.status !== 0) {
    console.log("\nNão deu para instalar. Confira a internet e abra o app de novo.\n");
    return false;
  }
  return true;
}

function preparar() {
  const marca = path.join(raiz, ".next", "coop-versao.txt");
  const versao = versaoDosArquivos();
  const pronto = existsSync(path.join(raiz, ".next", "BUILD_ID")) && existsSync(marca) && readFileSync(marca, "utf8") === versao;
  if (pronto) return true;
  console.log("\nPreparando o app (primeira vez ou depois de atualizar). Leva uns 2 minutos...\n");
  const r = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", env });
  if (r.status !== 0) return false;
  writeFileSync(marca, versao);
  return true;
}

function mostrarCelular() {
  const ends = enderecosNaRede();
  if (!ends.length) return;
  console.log("No CELULAR (no mesmo Wi-Fi deste PC), abra um destes endereços e digite o PIN:");
  for (const e of ends) console.log(`   ${e}`);
  console.log("Se o Windows perguntar, clique em Permitir acesso (redes privadas).\n");
}

async function main() {
  if (await respondendo()) {
    console.log(`\nO app já está aberto. Abrindo o navegador em ${url}\n`);
    mostrarCelular();
    abrirNavegador();
    return;
  }
  instalarSeFaltar();
  let modo = producao ? "start" : "dev";
  if (producao && !preparar()) {
    console.log("\nNão deu para preparar o app no modo final. Vou abrir no modo simples (funciona igual, só um pouco mais lento).\n");
    modo = "dev";
  }
  novaChave();
  console.log(`\nApp da Cooperativa: ${url}\nDeixe esta janela aberta enquanto usa. Para fechar o app, feche esta janela.\n`);
  // 0.0.0.0 = também na rede, para o celular (com PIN).
  const filho = spawn(process.execPath, [nextBin, modo, "-p", porta, "-H", "0.0.0.0"], { stdio: "inherit", env });
  filho.on("exit", (codigo) => process.exit(codigo ?? 0));
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await respondendo()) {
      console.log(`\nPronto! Abrindo ${url}\n`);
      mostrarCelular();
      abrirNavegador();
      return;
    }
    if (filho.exitCode !== null) return;
  }
  console.log(`\nO app está demorando. Tente abrir ${url} no navegador.\n`);
}

main();
