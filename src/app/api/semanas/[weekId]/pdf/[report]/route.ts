import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifySession } from "@/lib/dal";
import { buildReport, getWeekMeta } from "@/lib/pdf/reports";
import { isReportKey } from "@/lib/pdf/definitions";
import { DOCUMENT_SOURCES, methodologyOfRealCycle } from "@/lib/cycleCore/documents";

// Documentos da semana (plano §12): qualquer usuario autenticado pode
// baixar (e uma acao de leitura, igual imprimir um romaneio ja era).
export async function GET(req: Request, { params }: { params: Promise<{ weekId: string; report: string }> }) {
  await verifySession();
  const { weekId, report } = await params;

  if (!isReportKey(report)) {
    return NextResponse.json({ error: "Relatório desconhecido." }, { status: 404 });
  }
  const week = await getWeekMeta(weekId);
  if (!week) {
    return NextResponse.json({ error: "Semana não encontrada." }, { status: 404 });
  }
  // Ponto de troca da fonte por metodologia (spec 004 × 008). Enquanto nenhum
  // ciclo real tiver entrega por escola/produto registrada, todos usam os
  // documentos do modelo atual (docs/propostas-pendentes.md §10).
  if (DOCUMENT_SOURCES[methodologyOfRealCycle()][report] !== "ATUAL") {
    return NextResponse.json({ error: "Documento do novo modelo ainda sem persistência." }, { status: 501 });
  }

  // Romaneios: ?escola=<código> para uma escola só; ?vias=4 para imprimir as
  // 4 vias (escola, caminhão, 2× Merenda) — só apresentação, mesmos dados.
  const url = new URL(req.url);
  const schoolCode = url.searchParams.get("escola")?.trim() || undefined;
  const copies = url.searchParams.get("vias") === "4" ? 4 : 1;
  if (schoolCode && !/^[\w.-]{1,20}$/.test(schoolCode)) {
    return NextResponse.json({ error: "Código de escola inválido." }, { status: 400 });
  }
  const { fileName, element } = await buildReport(week, report, report === "romaneios-escolas" ? { schoolCode, copies } : {});
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
