// Textos e utilitários dos componentes de complementos e faltas (spec 008).
import type { AttendanceStatus, CycleState, ReceiptStatus, ShortageStatus } from "@/lib/domain/cycle";
import type { SupplySource } from "@/lib/domain/cycleLedger";

export interface CycleCoreNames {
  schools: Record<string, string>;
  products: Record<string, string>;
  producers: Record<string, string>;
}

type Tone = "ok" | "atencao" | "estourado" | "fechada";

export const RECEIPT_LABEL: Record<ReceiptStatus, [string, Tone]> = {
  SEM_PEDIDO: ["Sem pedido", "fechada"],
  PENDENTE_CONFERENCIA: ["Entrega pendente de conferência", "atencao"],
  CONFERIDO: ["Entrega conferida", "ok"],
  ERRO: ["Com erro", "estourado"],
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, [string, Tone]> = {
  SEM_PEDIDO: ["Sem pedido", "fechada"],
  OK: ["Pedido atendido", "ok"],
  FALTA: ["Falta", "estourado"],
  EXCEDENTE: ["Excedente", "atencao"],
};

export const SHORTAGE_LABEL: Record<ShortageStatus, [string, Tone] | null> = {
  NAO_APLICAVEL: null,
  SEM_DECISAO: ["Falta sem decisão", "estourado"],
  EM_RESOLUCAO: ["Falta em resolução", "atencao"],
  ENCERRADA_SEM_ATENDIMENTO: ["Falta encerrada sem atendimento", "fechada"],
  DECISAO_INCOERENTE: ["Decisão incoerente — revisar", "estourado"],
};

export const CYCLE_STATE_LABEL: Record<CycleState, string> = {
  AGUARDANDO_PEDIDO: "Aguardando pedido",
  EM_CONFERENCIA: "Em conferência",
  AGUARDANDO_DECISOES: "Aguardando decisões",
  COM_ERROS: "Com erros",
  PRONTO_PARA_FECHAR: "Pronto para fechar",
};

export function sourceLabel(source: SupplySource | null, names: CycleCoreNames): string {
  if (!source) return "—";
  if (source.type === "SALDO_GALPAO") return "Saldo do galpão";
  return names.producers[source.producerId] ?? source.producerId;
}

// Aceita "12,5" e "12.5". Vazio → null. Texto inválido → NaN (o domínio recusa).
export function parseQty(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  return Number(t);
}

export function fmtQty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function fmtMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export function newSubmissionKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
