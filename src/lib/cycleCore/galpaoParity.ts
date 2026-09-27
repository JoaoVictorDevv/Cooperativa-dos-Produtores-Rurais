// Validação da parte do galpão (recebimento, rejeição, a pagar), custos e
// diferença: o modelo atual × a lógica corrigida, para o MESMO ciclo. As duas
// usam as mesmas tabelas nessa parte, então os números têm de bater — se não
// baterem, há erro em um dos lados antes de qualquer troca de fonte.
//
// A cobrança da prefeitura pelo aceito na escola NÃO é validável: nenhum ciclo
// tem entrega por escola/produto registrada (bloqueio de persistência — Lucas).

import { round2 } from "../calc";
import { evaluateWarehouseReceipt, producerPayable } from "../domain/cycle";
import { ledgerClosingPreview, type CycleLedger } from "../domain/cycleLedger";
import { differenceReport, type DocumentNames } from "./documents";

export interface LegacyGalpao {
  producerLines: { producerId: string; productId: string; deliveredQty: number; returnedQty: number; netQty: number; payment: number }[];
  producersTotal: number;
  totalCosts: number;
  differenceLines: { productId: string; orderedQty: number; netDeliveredQty: number; difference: number }[];
  treasuryTotal: number;
  treasuryRounding: string;
}

export interface ParityCheck {
  area: "GALPAO_LINHA" | "GALPAO_TOTAL" | "CUSTOS" | "DIFERENCA";
  label: string;
  legacy: number;
  novo: number;
  ok: boolean;
}

export interface ParityReport {
  checks: ParityCheck[];
  mismatches: ParityCheck[];
  ok: boolean;
  anomalies: string[];
  notValidated: string[];
}

const same = (a: number, b: number) => Math.abs(round2(a) - round2(b)) < 0.005;

export function compareGalpao(
  legacy: LegacyGalpao,
  current: { ledger: CycleLedger; names: DocumentNames; costs: { amount: number }[]; returnsWithoutDelivery: { producerId: string; productId: string; qty: number }[] },
): ParityReport {
  const { ledger, names } = current;
  const n = (map: Record<string, string>, id: string) => map[id] ?? id;
  const checks: ParityCheck[] = [];
  const push = (area: ParityCheck["area"], label: string, legacyValue: number, novo: number) => checks.push({ area, label, legacy: round2(legacyValue), novo: round2(novo), ok: same(legacyValue, novo) });

  // Linha a linha: produtor × produto.
  const anomalies: string[] = [];
  for (const line of legacy.producerLines) {
    const label = `${n(names.producers, line.producerId)} — ${n(names.products, line.productId)}`;
    const receipt = ledger.warehouseReceipts.find((r) => r.producerId === line.producerId && r.productId === line.productId);
    if (!receipt) {
      anomalies.push(`${label}: está no modelo atual e não foi encontrado no núcleo.`);
      continue;
    }
    const result = evaluateWarehouseReceipt(receipt);
    if (result.status !== "CONFERIDO") {
      anomalies.push(`${label}: o núcleo acusa ${result.status === "ERRO" ? result.errors.map((e) => e.message).join(" ") : "recebimento não conferido"}.`);
      continue;
    }
    push("GALPAO_LINHA", `${label}: bruto`, line.deliveredQty, receipt.grossQty ?? 0);
    push("GALPAO_LINHA", `${label}: rejeição no galpão`, line.returnedQty, result.rejectedQty);
    push("GALPAO_LINHA", `${label}: aceito`, line.netQty, result.acceptedQty);
    push("GALPAO_LINHA", `${label}: a pagar`, line.payment, producerPayable(result.acceptedQty, receipt.price ?? 0, receipt.logisticsDeductionSnapshot ?? 0));
  }
  if (legacy.producerLines.length !== ledger.warehouseReceipts.length) {
    anomalies.push(`Quantidade de lançamentos no galpão diferente: modelo atual ${legacy.producerLines.length}, núcleo ${ledger.warehouseReceipts.length}.`);
  }
  for (const r of current.returnsWithoutDelivery) {
    anomalies.push(
      `${n(names.producers, r.producerId)} — ${n(names.products, r.productId)}: devolução de ${r.qty} no galpão sem entrega registrada (o modelo atual ignora no pagamento; o núcleo trataria como erro).`,
    );
  }

  // Totais.
  const preview = ledgerClosingPreview(ledger);
  push("GALPAO_TOTAL", "Total a pagar aos produtores", legacy.producersTotal, preview.payableTotal);
  push("CUSTOS", "Custos reais registrados", legacy.totalCosts, current.costs.reduce((a, c) => a + c.amount, 0));

  // Diferença do galpão por produto: pedido das escolas e líquido do galpão.
  const diff = differenceReport(ledger, names);
  for (const line of legacy.differenceLines) {
    const row = diff.find((d) => d.productId === line.productId);
    const label = n(names.products, line.productId);
    push("DIFERENCA", `${label}: pedido das escolas`, line.orderedQty, row?.orderedBySchools ?? 0);
    push("DIFERENCA", `${label}: líquido do galpão`, line.netDeliveredQty, row?.acceptedAtWarehouse ?? 0);
    push("DIFERENCA", `${label}: diferença (líquido − pedido)`, line.difference, round2((row?.acceptedAtWarehouse ?? 0) - (row?.orderedBySchools ?? 0)));
  }

  const mismatches = checks.filter((c) => !c.ok);
  return {
    checks,
    mismatches,
    ok: mismatches.length === 0 && anomalies.length === 0,
    anomalies,
    notValidated: [
      `Cobrança da prefeitura pelo aceito na escola: sem base em nenhum ciclo — não há registro de entrega por escola/produto (bloqueio de persistência do Lucas). ` +
        `O valor oficial deste ciclo continua o do modelo atual (pedido − devolução): ${round2(legacy.treasuryTotal).toFixed(2)}, arredondamento ${legacy.treasuryRounding}. Não recalculado.`,
      "Falta, excedente, rejeição e perda por escola, complementos e decisões de falta: mesmos motivos.",
    ],
  };
}

export function parityMarkdown(report: ParityReport, title: string): string {
  const lines = [`# ${title}`, "", report.ok ? "**Resultado: OK — galpão, custos e diferença batem.**" : "**Resultado: DIVERGÊNCIA — ver abaixo.**", ""];
  const byArea = (area: ParityCheck["area"]) => report.checks.filter((c) => c.area === area);
  const areas: [ParityCheck["area"], string][] = [
    ["GALPAO_TOTAL", "Total a pagar"],
    ["CUSTOS", "Custos"],
    ["GALPAO_LINHA", "Galpão, linha a linha"],
    ["DIFERENCA", "Diferença do galpão"],
  ];
  for (const [area, heading] of areas) {
    const cs = byArea(area);
    const bad = cs.filter((c) => !c.ok).length;
    lines.push(`## ${heading}: ${cs.length - bad}/${cs.length} conferem`);
    for (const c of cs.filter((x) => !x.ok || area !== "GALPAO_LINHA")) lines.push(`- ${c.ok ? "OK" : "DIVERGE"} · ${c.label}: atual ${c.legacy} × núcleo ${c.novo}`);
    lines.push("");
  }
  if (report.anomalies.length) lines.push("## Anomalias", ...report.anomalies.map((a) => `- ${a}`), "");
  lines.push("## Não validado (e por quê)", ...report.notValidated.map((a) => `- ${a}`), "");
  return lines.join("\n");
}
