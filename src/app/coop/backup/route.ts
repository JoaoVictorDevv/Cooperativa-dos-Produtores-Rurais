import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { gravarMeta, modoLocal, pastaDados } from "@/lib/coop/armazem";

export const dynamic = "force-dynamic";

// Baixa um zip com toda a pasta de dados (cadastro, semanas, previsões).
// É o backup: guardar num pendrive ou no Drive.
export async function GET() {
  if (!modoLocal()) return NextResponse.json({ erro: "Só no modo local." }, { status: 403 });
  const base = pastaDados();
  const zip = new JSZip();
  async function juntar(dir: string, rel: string) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name.endsWith(".tmp")) continue;
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await juntar(abs, r);
      else if (e.name.endsWith(".json")) zip.file(`dados-cooperativa/${r}`, await fs.readFile(abs));
    }
  }
  try {
    await juntar(base, "");
  } catch {
    return NextResponse.json({ erro: "Pasta de dados não encontrada." }, { status: 404 });
  }
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const hoje = new Date().toISOString().slice(0, 10);
  await gravarMeta({ ultimoBackup: hoje });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="backup-cooperativa-${hoje}.zip"` },
  });
}
