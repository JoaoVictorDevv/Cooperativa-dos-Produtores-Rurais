"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmOrdersFromAllocation, previewOrdersFromAllocation } from "@/app/actions/producerOrdersFromAllocation";
import { formatQtyNumber } from "@/lib/format";
import {
  allocationPlanSignature,
  planOrdersFromAllocation,
  type AllocationLineKind,
  type AllocationPlanDecisions,
  type AllocationPlanInput,
} from "@/lib/producerOrdersFromAllocation";

const KIND_LABEL: Record<AllocationLineKind, string> = {
  NOVO: "Será criado",
  IGUAL: "Já igual à divisão",
  DIFERENTE: "Pedido diferente da divisão",
  SEM_DIVISAO: "Pedido sem divisão (mantido)",
  FORA_DA_OFERTA: "Fora da oferta (não gera)",
};
const KIND_ORDER: AllocationLineKind[] = ["NOVO", "DIFERENTE", "SEM_DIVISAO", "FORA_DA_OFERTA", "IGUAL"];
const linkButton = { background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" } as const;

// Divisão = planejamento; pedido = o que é emitido ao produtor. Esta tela
// transforma a divisão em pedidos com prévia, sem redigitar, e sem mexer em
// pedido digitado diferente (a não ser por escolha explícita) nem em entregas.
export function GenerateOrdersFromAllocation({ weekId }: { weekId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<AllocationPlanInput | null>(null);
  const [producerNames, setProducerNames] = useState<Map<string, string>>(new Map());
  const [decisions, setDecisions] = useState<AllocationPlanDecisions>({ replaceWithAllocation: {} });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [busy, startTransition] = useTransition();

  const plan = useMemo(() => (input ? planOrdersFromAllocation(input, decisions) : null), [input, decisions]);
  const productName = useMemo(() => new Map((input?.products ?? []).map((p) => [p.id, p.name])), [input]);

  function loadPreview() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const r = await previewOrdersFromAllocation(weekId);
      if (!r.ok || !r.input) {
        setError(r.error ?? "Erro ao montar a prévia.");
        return;
      }
      setInput(r.input);
      setProducerNames(new Map((r.producers ?? []).map((p) => [p.id, `${p.name} (${p.internalId})`])));
      setDecisions({ replaceWithAllocation: {} });
    });
  }

  function confirm() {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const r = await confirmOrdersFromAllocation(weekId, decisions, allocationPlanSignature(plan));
      if (!r.ok) {
        setError(r.error ?? "Erro ao gerar os pedidos.");
        return;
      }
      setDone(`Pedidos gerados: ${r.created} criado(s), ${r.updated} atualizado(s). Registrado na auditoria.`);
      setInput(null);
      router.refresh();
    });
  }

  function toggleReplace(key: string, value: boolean) {
    setDecisions((d) => {
      const next = { ...d.replaceWithAllocation };
      if (value) next[key] = true;
      else delete next[key];
      return { replaceWithAllocation: next };
    });
  }

  const visibleLines = (plan?.lines ?? [])
    .filter((l) => showUnchanged || l.kind !== "IGUAL")
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (producerNames.get(a.producerId) ?? "").localeCompare(producerNames.get(b.producerId) ?? ""));

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <button type="button" className="link-action" style={linkButton} onClick={() => setOpen((v) => !v)}>
        {open ? "− Fechar" : "+ Gerar pedidos aos produtores a partir da divisão"}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
          <p className="stat-sub">
            A <strong>divisão</strong> é o planejamento de quanto cada produtor vai fornecer; o <strong>pedido</strong> é o que é emitido ao
            produtor. Aqui a divisão vira pedido sem redigitar. Pedido já digitado com valor diferente é mantido, a menos que você marque para
            substituir. Nenhum pedido é apagado e nenhuma entrega é alterada.
          </p>
          {!input && (
            <div>
              <button type="button" className="btn-primary" disabled={busy} onClick={loadPreview}>
                {busy ? "Carregando…" : "Ver prévia"}
              </button>
            </div>
          )}
          {error && (
            <p style={{ color: "var(--brick)", fontSize: 13.5 }} role="alert">
              {error}
            </p>
          )}
          {done && (
            <p style={{ color: "var(--forest)", fontSize: 13.5 }} role="status">
              {done}
            </p>
          )}

          {plan && (
            <>
              <section>
                <div className="section-title">Demanda das escolas × divisão × pedidos</div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Demanda das escolas</th>
                        <th>Divisão</th>
                        <th>Pedidos hoje</th>
                        <th>Pedidos depois</th>
                        <th>Falta pedir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.byProduct.map((p) => (
                        <tr key={p.productId}>
                          <td>{productName.get(p.productId)}</td>
                          <td className="mono">
                            {formatQtyNumber(p.schoolDemand)} {p.unit}
                          </td>
                          <td className="mono">{formatQtyNumber(p.allocated)}</td>
                          <td className="mono">{formatQtyNumber(p.orderedBefore)}</td>
                          <td className="mono">
                            <strong>{formatQtyNumber(p.orderedAfter)}</strong>
                          </td>
                          <td className="mono" style={p.gap > 0 ? { color: "var(--brick)" } : undefined}>
                            {p.gap > 0 ? formatQtyNumber(p.gap) : p.gap < 0 ? `${formatQtyNumber(-p.gap)} a mais` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-foot-note" style={{ textAlign: "left" }}>
                  Comparação de planejamento, na unidade de cada produto. Não é entrega nem recebimento.
                </p>
              </section>

              <section>
                <div className="section-title">Pedidos por produtor</div>
                <div className="toolbar">
                  {KIND_ORDER.map((k) => (
                    <span key={k} className="filter-chip">
                      {KIND_LABEL[k]}: {plan.counts[k]}
                    </span>
                  ))}
                  <button type="button" className={`filter-chip${showUnchanged ? " active" : ""}`} onClick={() => setShowUnchanged((v) => !v)}>
                    {showUnchanged ? "Ocultar iguais" : "Mostrar iguais"}
                  </button>
                </div>
                <div className="table-scroll" style={{ maxHeight: 420 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Produtor</th>
                        <th>Produto</th>
                        <th>Divisão</th>
                        <th>Pedido hoje</th>
                        <th>Pedido depois</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.map((l) => (
                        <tr key={l.key}>
                          <td className="name-cell">{producerNames.get(l.producerId) ?? l.producerId}</td>
                          <td>{productName.get(l.productId)}</td>
                          <td className="mono">{formatQtyNumber(l.allocatedQty)}</td>
                          <td className="mono">{l.currentOrderQty === null ? "—" : formatQtyNumber(l.currentOrderQty)}</td>
                          <td className="mono">
                            <strong>{l.resultingOrderQty === null ? "—" : formatQtyNumber(l.resultingOrderQty)}</strong>
                          </td>
                          <td style={{ fontSize: 12.5 }}>
                            {KIND_LABEL[l.kind]}
                            {l.kind === "DIFERENTE" && (
                              <label style={{ display: "block", marginTop: 4 }}>
                                <input type="checkbox" checked={!!decisions.replaceWithAllocation[l.key]} onChange={(e) => toggleReplace(l.key, e.target.checked)} /> Substituir
                                pelo valor da divisão ({formatQtyNumber(l.allocatedQty)})
                              </label>
                            )}
                          </td>
                        </tr>
                      ))}
                      {visibleLines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="table-foot-note">
                            Nada a mostrar: não há divisão nem pedidos diferentes da divisão.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="btn-primary" disabled={busy || plan.toWrite.length === 0} onClick={confirm}>
                  {busy ? "Gravando…" : `Gerar ${plan.counts.create} e atualizar ${plan.counts.update} pedido(s)`}
                </button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => setInput(null)}>
                  Cancelar
                </button>
                {plan.toWrite.length === 0 && <span className="stat-sub">Nada a gerar: os pedidos já correspondem à divisão.</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
