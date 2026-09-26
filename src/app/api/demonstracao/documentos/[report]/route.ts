import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { DEMO_NAMES } from "@/lib/cycleCore/demoScenario";
import { buildCycleCoreReport, isCycleCoreReportKey } from "@/lib/pdf/cycleCoreReports";
import { demoMeta, readDemoLedger } from "../shared";

export async function POST(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isCycleCoreReportKey(report)) return NextResponse.json({ error: "Documento desconhecido." }, { status: 404 });
  const read = await readDemoLedger(req);
  if ("error" in read) return read.error;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get("escola")?.trim() || undefined;
  if (schoolId && !/^[\w.-]{1,20}$/.test(schoolId)) return NextResponse.json({ error: "Código de escola inválido." }, { status: 400 });
  const copies = url.searchParams.get("vias") === "4" ? 4 : 1;

  const { fileName, element } = buildCycleCoreReport(read.ledger, DEMO_NAMES, demoMeta(read.ledger), report, report === "romaneios-escolas" ? { schoolId, copies } : {});
  const buffer = await renderToBuffer(element);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"` },
  });
}
