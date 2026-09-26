import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { parseLedger } from "@/lib/cycleCore/ledgerSchema";
import { fmtDateTimePdf } from "@/lib/pdf/styles";
import type { CycleCoreMeta } from "@/lib/pdf/cycleCoreReports";
import type { CycleLedger } from "@/lib/domain/cycleLedger";

// Documentos da tela de demonstração (/complementos-faltas): o navegador envia
// o estado em memória, o servidor valida e devolve o PDF. Nada é lido do
// banco nem gravado; os nomes vêm do cenário fictício do servidor.
const MAX_BYTES = 2_000_000;

export async function readDemoLedger(req: Request): Promise<{ ledger: CycleLedger } | { error: NextResponse }> {
  await verifySession();
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return { error: NextResponse.json({ error: "Dados grandes demais." }, { status: 413 }) };
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return { error: NextResponse.json({ error: "Dados grandes demais." }, { status: 413 }) };
    body = JSON.parse(raw);
  } catch {
    return { error: NextResponse.json({ error: "Dados inválidos." }, { status: 400 }) };
  }
  const ledger = parseLedger((body as { ledger?: unknown })?.ledger);
  if (!ledger) return { error: NextResponse.json({ error: "Dados do ciclo inválidos." }, { status: 400 }) };
  return { ledger };
}

export function demoMeta(ledger: CycleLedger): CycleCoreMeta {
  return {
    cycleLabel: "Ciclo de demonstração (dados fictícios)",
    status: ledger.status === "ABERTO" ? "ABERTA" : "FECHADA",
    issuedAt: fmtDateTimePdf(new Date()),
    fileBase: "demonstracao",
    cycleCode: "DEMO",
    banner: "DEMONSTRAÇÃO — dados fictícios, nada foi gravado. Não usar para cobrança ou pagamento.",
  };
}
