import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import { DEMO_NAMES } from "@/lib/cycleCore/demoScenario";
import { CYCLE_CORE_REPORTS, buildCycleCoreReport } from "@/lib/pdf/cycleCoreReports";
import { demoMeta, readDemoLedger } from "../shared";

// ZIP da demonstração: uma via de cada documento que o núcleo sabe montar.
// "Pedidos aos Produtores" não entra: continua vindo das tabelas atuais.
export async function POST(req: Request) {
  const read = await readDemoLedger(req);
  if ("error" in read) return read.error;
  const meta = demoMeta(read.ledger);
  const zip = new JSZip();
  for (const { key } of CYCLE_CORE_REPORTS) {
    const { fileName, element } = buildCycleCoreReport(read.ledger, DEMO_NAMES, meta, key);
    zip.file(fileName, await renderToBuffer(element));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="demonstracao-documentos.zip"` },
  });
}
