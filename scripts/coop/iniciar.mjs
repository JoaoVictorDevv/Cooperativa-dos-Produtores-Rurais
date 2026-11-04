// Abre o app da Cooperativa no computador: npm run coop
// Liga o modo local (sem login, dados em ./dados-cooperativa) e inicia o Next.
// Só escuta no próprio computador (127.0.0.1): sem login, não pode abrir na rede.
import { spawn } from "node:child_process";

const porta = process.env.PORT || "3000";
const modo = process.argv[2] === "producao" ? ["start"] : ["dev"];
console.log(`\nApp da Cooperativa: abra http://localhost:${porta}/coop no navegador.\n`);
const filho = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", ...modo, "-p", porta, "-H", "127.0.0.1"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, COOP_LOCAL: "1" },
});
filho.on("exit", (codigo) => process.exit(codigo ?? 0));
