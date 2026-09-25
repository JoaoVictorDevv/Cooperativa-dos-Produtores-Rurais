import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import { verifySession } from "@/lib/dal";
import { buildReport, getWeekMeta } from "@/lib/pdf/reports";
import { REPORT_DEFINITIONS } from "@/lib/pdf/definitions";

// Pacote ZIP com todos os documentos da semana (plano §12). Mesma
// permissao dos arquivos individuais — respeita a sessao, nao ha
// diferenca de acesso entre baixar um arquivo ou o pacote inteiro.
export async function GET(_req: Request, { params }: { params: Promise<{ weekId: string }> }) {
  await verifySession();
  const { weekId } = await params;

  const week = await getWeekMeta(weekId);
  if (!week) {
    return NextResponse.json({ error: "Semana não encontrada." }, { status: 404 });
  }

  const zip = new JSZip();
  for (const { key } of REPORT_DEFINITIONS) {
    const { fileName, element } = await buildReport(week, key);
    const buffer = await renderToBuffer(element);
    zip.file(fileName, buffer);
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="semana-${week.number}-documentos.zip"`,
    },
  });
}
