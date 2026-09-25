import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifySession } from "@/lib/dal";
import { buildReport, getWeekMeta } from "@/lib/pdf/reports";
import { isReportKey } from "@/lib/pdf/definitions";

// Documentos da semana (plano §12): qualquer usuario autenticado pode
// baixar (e uma acao de leitura, igual imprimir um romaneio ja era).
export async function GET(_req: Request, { params }: { params: Promise<{ weekId: string; report: string }> }) {
  await verifySession();
  const { weekId, report } = await params;

  if (!isReportKey(report)) {
    return NextResponse.json({ error: "Relatório desconhecido." }, { status: 404 });
  }
  const week = await getWeekMeta(weekId);
  if (!week) {
    return NextResponse.json({ error: "Semana não encontrada." }, { status: 404 });
  }

  const { fileName, element } = await buildReport(week, report);
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
