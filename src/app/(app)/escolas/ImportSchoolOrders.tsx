"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmSchoolOrdersImport, previewSchoolOrdersImport, type ImportWeekInfo } from "@/app/actions/schoolOrdersImport";
import { formatQtyNumber } from "@/lib/format";
import { buildImportPlan, defaultDecisions, lineKey, planSignature, type ImportDecisions, type LineChange, type PendingItem, type PlanContext } from "@/lib/import/plan";
import type { ParsedSheet, ParsedWorkbook } from "@/lib/import/types";

const RED = { color: "var(--brick)" } as const;
const SMALL = { fontSize: 12.5 } as const;

const SHEET_KIND: Record<ParsedSheet["kind"], string> = {
  PEDIDOS: "Pedidos por escola",
  TOTALIZACAO: "Só totais (não importável)",
  VAZIA: "Vazia",
  NAO_RECONHECIDA: "Não reconhecida",
};

const COLUMN_STATUS: Record<string, string> = {
  INCLUIDA: "Incluída",
  SUGESTAO_PENDENTE: "Confirmar produto",
  DUPLICADA: "Duplicada — escolha uma",
  UNIDADE_DIFERENTE: "Unidade diferente — não importada",
  FORA_DA_OFERTA: "Fora da oferta ativa",
  NAO_RECONHECIDA: "Não reconhecida",
  EXCLUIDA_POR_DECISAO: "Excluída por decisão",
};

function isOutside(g: { statuses: Set<string> }) {
  return g.statuses.has("FORA_DA_OFERTA") || g.statuses.has("NAO_RECONHECIDA");
}

const CHANGE_LABEL: Record<LineChange, string> = { NOVO: "Novo", ALTERACAO: "Alteração", ZERAR: "Zerar", SEM_MUDANCA: "Sem mudança" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Importação do pedido da prefeitura (specs/009). Lê e reconhece no
// servidor; aqui só se conferem e decidem pendências. A gravação relê o mesmo
// arquivo no servidor e só acontece se o resultado for idêntico à prévia.
export function ImportSchoolOrders({ weekId }: { weekId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [context, setContext] = useState<PlanContext | null>(null);
  const [week, setWeek] = useState<ImportWeekInfo | null>(null);
  const [decisions, setDecisions] = useState<ImportDecisions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [changeFilter, setChangeFilter] = useState<LineChange | "TODAS">("TODAS");
  const [showOutside, setShowOutside] = useState(false);
  const [busy, startTransition] = useTransition();

  const plan = useMemo(() => (parsed && context && decisions ? buildImportPlan(parsed, decisions, context) : null), [parsed, context, decisions]);
  const schoolById = useMemo(() => new Map((context?.schools ?? []).map((s) => [s.id, s])), [context]);
  const productById = useMemo(() => new Map((context?.products ?? []).map((p) => [p.id, p])), [context]);
  const offeredProducts = useMemo(() => (context?.products ?? []).filter((p) => p.offered), [context]);

  function reset() {
    setFile(null);
    setParsed(null);
    setContext(null);
    setDecisions(null);
    setShowAllLines(false);
  }

  function handleFile(f: File) {
    setError(null);
    setDone(null);
    reset();
    const fd = new FormData();
    fd.set("weekId", weekId);
    fd.set("file", f);
    startTransition(async () => {
      const r = await previewSchoolOrdersImport(fd);
      if (!r.ok || !r.parsed || !r.context) {
        setError(r.error ?? "Erro ao ler o arquivo.");
        return;
      }
      setFile(f);
      setParsed(r.parsed);
      setContext(r.context);
      setWeek(r.week ?? null);
      setDecisions(defaultDecisions(r.parsed));
    });
  }

  function patch(p: Partial<ImportDecisions>) {
    setDecisions((d) => (d ? { ...d, ...p } : d));
  }
  function patchRecord<K extends "columnProduct" | "rowSchool" | "duplicateSchool" | "cellValue" | "excludedLines">(key: K, entries: Record<string, ImportDecisions[K][string] | undefined>) {
    setDecisions((d) => {
      if (!d) return d;
      const next = { ...d[key] } as Record<string, unknown>;
      for (const [k, v] of Object.entries(entries)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      return { ...d, [key]: next };
    });
  }

  function handleConfirm() {
    if (!plan || !file || !decisions || !plan.canConfirm) return;
    setError(null);
    const fd = new FormData();
    fd.set("weekId", weekId);
    fd.set("file", file);
    fd.set("decisions", JSON.stringify(decisions));
    fd.set("signature", planSignature(plan));
    startTransition(async () => {
      const r = await confirmSchoolOrdersImport(fd);
      if (!r.ok || !r.written) {
        setError(r.error ?? "Erro ao gravar a importação.");
        return;
      }
      const w = r.written;
      setDone(`Gravado: ${w.created} novo(s), ${w.updated} alterado(s), ${w.zeroed} zerado(s) — ${formatQtyNumber(w.qty)} no total. Origem registrada na auditoria.`);
      reset();
      router.refresh();
    });
  }

  const selectedSheets = parsed?.sheets.filter((s) => s.kind === "PEDIDOS" && decisions?.selectedSheets.includes(s.name)) ?? [];

  // Colunas agrupadas pelo rótulo: a mesma decisão vale para todas as abas selecionadas.
  const columnGroups = useMemo(() => {
    if (!plan) return [];
    const groups = new Map<string, { label: string; keys: string[]; statuses: Set<string>; productId: string | null; cells: number; suggestions: string[] }>();
    for (const c of plan.columns) {
      const sheet = parsed!.sheets.find((s) => s.name === c.sheet)!;
      const col = sheet.columns.find((x) => x.letter === c.letter)!;
      const g = groups.get(c.label) ?? { label: c.label, keys: [], statuses: new Set<string>(), productId: null, cells: 0, suggestions: [] as string[] };
      g.keys.push(`${c.sheet}!${c.letter}`);
      g.statuses.add(c.status);
      g.productId = g.productId ?? c.productId;
      g.cells += c.filledCells;
      if (col.match.kind === "SUGESTAO") g.suggestions = col.match.candidateIds;
      groups.set(c.label, g);
    }
    return [...groups.values()];
  }, [plan, parsed]);

  const pendingBy = (kinds: PendingItem["kind"][]) => plan?.pending.filter((p) => kinds.includes(p.kind)) ?? [];
  const schoolPending = pendingBy(["ESCOLA_DESCONHECIDA", "ESCOLA_NOME_DIVERGENTE", "CODIGO_ILEGIVEL"]);
  const duplicatePending = pendingBy(["ESCOLA_DUPLICADA"]);
  const ambiguous = pendingBy(["CELULA_AMBIGUA"]);
  const invalid = pendingBy(["CELULA_INVALIDA"]);
  const precision = pendingBy(["CELULA_PRECISAO"]);
  const belowReturn = pendingBy(["ABAIXO_DA_DEVOLUCAO"]);

  const invalidGroups = useMemo(() => {
    const m = new Map<string, { reason: string; where: string[] }>();
    for (const p of invalid) {
      const reason = p.message.replace(/^"[^"]*": /, "");
      const k = `${p.sheet}|${reason}`;
      const g = m.get(k) ?? { reason: `${p.sheet}: ${reason}`, where: [] };
      g.where.push(p.where);
      m.set(k, g);
    }
    return [...m.values()];
  }, [invalid]);

  const visibleLines = (plan?.lines ?? []).filter((l) => l.change !== "SEM_MUDANCA" && (changeFilter === "TODAS" || l.change === changeFilter));
  const lineLimit = showAllLines ? visibleLines.length : 150;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <button
        type="button"
        className="link-action"
        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "− Fechar importação" : "+ Importar pedido da prefeitura (Excel ou PDF com texto)"}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="stat-sub" style={{ marginBottom: 8 }}>
            Preenche só o <strong>pedido das escolas</strong> deste ciclo. Não cria entregas nem pedidos aos produtores. Colunas de
            &quot;Entrega&quot; do arquivo são ignoradas. Nada é gravado antes da sua confirmação.
          </p>
          <input
            type="file"
            accept=".xlsx,.pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {busy && <p className="stat-sub">Processando no servidor…</p>}
          {error && (
            <p style={{ ...RED, fontSize: 13.5, marginTop: 8 }} role="alert">
              {error}
            </p>
          )}
          {done && (
            <p style={{ color: "var(--forest)", fontSize: 13.5, marginTop: 8 }} role="status">
              {done}
            </p>
          )}

          {parsed && plan && decisions && context && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
              <p style={{ fontSize: 13, overflowWrap: "anywhere" }}>
                Arquivo <strong>{parsed.fileName}</strong> ({parsed.source === "pdf" ? "PDF com texto" : "Excel"}) → ciclo de destino{" "}
                <strong>
                  Semana {week?.number}
                  {week ? ` (${fmtDate(week.startDate)} a ${fmtDate(week.endDate)})` : ""}
                </strong>
                .{" "}
                <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }} onClick={reset}>
                  Cancelar
                </button>
              </p>

              <section>
                <div className="section-title">1. Abas / páginas</div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Importar</th>
                        <th>Aba</th>
                        <th>Situação</th>
                        <th>Reconhecimento</th>
                        <th>Escolas</th>
                        <th>Colunas de pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.sheets.map((s) => (
                        <tr key={s.name}>
                          <td>
                            <input
                              type="checkbox"
                              disabled={s.kind !== "PEDIDOS"}
                              checked={decisions.selectedSheets.includes(s.name)}
                              onChange={(e) =>
                                patch({ selectedSheets: e.target.checked ? [...decisions.selectedSheets, s.name] : decisions.selectedSheets.filter((x) => x !== s.name) })
                              }
                              aria-label={`Importar ${s.name}`}
                            />
                          </td>
                          <td className="name-cell">
                            {s.name}
                            {s.hidden && <span className="badge fechada" style={{ marginLeft: 6 }}>oculta</span>}
                          </td>
                          <td style={SMALL}>
                            {SHEET_KIND[s.kind]}
                            {s.reason && <div className="stat-sub">{s.reason}</div>}
                            {s.updateMarker && <div className="stat-sub">{s.updateMarker}</div>}
                          </td>
                          <td style={SMALL}>
                            {s.kind === "PEDIDOS" && (
                              <>
                                Cabeçalho na(s) linha(s) {s.headerRows.join(" e ")}; código na coluna {s.codeCol}
                                {s.nameCol ? `, nome na ${s.nameCol}` : ""}
                                {s.deliveryColumnsIgnored > 0 && `; ${s.deliveryColumnsIgnored} coluna(s) de Entrega ignorada(s)`}
                                {s.otherColumnsIgnored.length > 0 && `; ignoradas: ${s.otherColumnsIgnored.map((c) => `${c.letter} "${c.label}"`).join(", ")}`}
                                {s.unrecognizedRows.length > 0 && (
                                  <details className="stat-sub">
                                    <summary>{s.unrecognizedRows.length} linha(s) não reconhecida(s) — não importadas</summary>
                                    {s.unrecognizedRows.slice(0, 10).map((r) => (
                                      <div key={r.row}>
                                        Linha {r.row}: {r.text.slice(0, 80)}
                                      </div>
                                    ))}
                                    {s.unrecognizedRows.length > 10 && <div>…</div>}
                                  </details>
                                )}
                              </>
                            )}
                          </td>
                          <td className="mono">{s.rows.length}</td>
                          <td className="mono">{s.columns.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-foot-note" style={{ textAlign: "left" }}>
                  Abas ocultas, de totais ou de outra época não são marcadas por padrão. Marcar duas abas com a mesma escola gera uma pendência de
                  duplicidade — nada é somado sem sua decisão.
                </p>
              </section>

              {selectedSheets.length > 0 && (
                <section>
                  <div className="section-title">2. Produtos (colunas de Pedido)</div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Coluna no arquivo</th>
                          <th>Situação</th>
                          <th>Produto do cadastro</th>
                          <th>Células preenchidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showOutside ? columnGroups : columnGroups.filter((g) => !isOutside(g)))
                          .sort((a, b) => Number(isOutside(a)) - Number(isOutside(b)))
                          .map((g) => {
                            const current = g.keys.map((k) => (k in decisions.columnProduct ? decisions.columnProduct[k] : undefined))[0];
                            const value = current === null ? "__EXCLUIR" : current ?? g.productId ?? "";
                            const outside = isOutside(g);
                            return (
                              <tr key={g.label} style={outside ? { opacity: 0.7 } : undefined}>
                                <td className="name-cell">
                                  {g.label}
                                  <span className="stat-sub"> ({g.keys.length} aba(s))</span>
                                </td>
                                <td style={{ ...SMALL, ...(g.statuses.has("SUGESTAO_PENDENTE") || g.statuses.has("DUPLICADA") ? RED : {}) }}>
                                  {[...g.statuses].map((s) => COLUMN_STATUS[s]).join(" / ")}
                                </td>
                                <td>
                                  <select
                                    value={value}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      const decided = v === "" ? undefined : v === "__EXCLUIR" ? null : v;
                                      patchRecord("columnProduct", Object.fromEntries(g.keys.map((k) => [k, decided])));
                                    }}
                                    aria-label={`Produto para ${g.label}`}
                                  >
                                    <option value="">{g.productId ? "(reconhecido)" : g.suggestions.length ? "— confirmar —" : "— não importar —"}</option>
                                    {(g.suggestions.length ? offeredProducts.filter((p) => g.suggestions.includes(p.id)) : []).map((p) => (
                                      <option key={`s-${p.id}`} value={p.id}>
                                        Sugestão: {p.name} ({p.unit})
                                      </option>
                                    ))}
                                    {offeredProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.unit})
                                      </option>
                                    ))}
                                    <option value="__EXCLUIR">Excluir esta coluna</option>
                                  </select>
                                  {g.productId && <span className="stat-sub"> → {productById.get(g.productId)?.name}</span>}
                                </td>
                                <td className="mono">{g.cells}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {columnGroups.some(isOutside) && (
                    <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", marginTop: 6 }} onClick={() => setShowOutside((v) => !v)}>
                      {showOutside
                        ? "Ocultar colunas fora da oferta"
                        : `Mostrar ${columnGroups.filter(isOutside).length} coluna(s) fora da oferta ativa ou não reconhecidas (não importadas): ${columnGroups
                            .filter(isOutside)
                            .map((g) => g.label)
                            .join(", ")}`}
                    </button>
                  )}
                  <label style={{ display: "block", marginTop: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={decisions.unitConfirmed} onChange={(e) => patch({ unitConfirmed: e.target.checked })} /> As colunas
                    sem unidade no cabeçalho estão na unidade do cadastro (kg). Nenhuma conversão é feita.
                  </label>
                  {pendingBy(["COLUNA_UNIDADE"]).map((p) => (
                    <p key={p.key} style={{ ...SMALL, ...RED }}>
                      {p.sheet} {p.where}: {p.message}
                    </p>
                  ))}
                </section>
              )}

              {(schoolPending.length > 0 || duplicatePending.length > 0) && (
                <section>
                  <div className="section-title">3. Escolas que precisam de decisão</div>
                  {schoolPending.length > 0 && (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Onde</th>
                            <th>Problema</th>
                            <th>Decisão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schoolPending.map((p) => {
                            const [sheetName, rowNumber] = [p.sheet!, Number(p.where.replace("linha ", ""))];
                            const row = parsed.sheets.find((s) => s.name === sheetName)?.rows.find((r) => r.row === rowNumber);
                            const suggestions =
                              row?.school.k === "NOME_DIVERGENTE" ? [row.school.schoolId] : row && "suggestionIds" in row.school ? row.school.suggestionIds : [];
                            return (
                              <tr key={p.key}>
                                <td style={SMALL}>
                                  {sheetName}, {p.where}
                                </td>
                                <td style={SMALL}>{p.message}</td>
                                <td>
                                  <select
                                    value=""
                                    onChange={(e) => patchRecord("rowSchool", { [p.key]: e.target.value === "__EXCLUIR" ? null : e.target.value })}
                                    aria-label={`Decisão para ${sheetName} ${p.where}`}
                                  >
                                    <option value="">— decidir —</option>
                                    {suggestions.map((id) => (
                                      <option key={`s-${id}`} value={id}>
                                        {row?.school.k === "NOME_DIVERGENTE" ? "Confirmar: é " : "Sugestão: "}
                                        {schoolById.get(id)?.code} {schoolById.get(id)?.name}
                                      </option>
                                    ))}
                                    {row?.school.k !== "NOME_DIVERGENTE" &&
                                      context.schools.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.code} {s.name}
                                        </option>
                                      ))}
                                    <option value="__EXCLUIR">Excluir esta linha</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {Object.entries(decisions.rowSchool).length > 0 && (
                    <p style={SMALL}>
                      Decisões tomadas: {Object.entries(decisions.rowSchool).length}.{" "}
                      <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => patch({ rowSchool: {} })}>
                        Desfazer decisões de escola
                      </button>
                    </p>
                  )}
                  {duplicatePending.map((p) => {
                    const rows = p.where.split("; ");
                    return (
                      <div key={p.key} style={{ ...SMALL, marginTop: 8 }}>
                        <span style={RED}>{p.message}</span>{" "}
                        <select value="" onChange={(e) => patchRecord("duplicateSchool", { [p.key]: e.target.value })} aria-label="Decisão de duplicidade">
                          <option value="">— decidir —</option>
                          <option value="SOMAR">Somar as ocorrências</option>
                          {rows.map((r) => (
                            <option key={r} value={r}>
                              Usar só {r.replace("!", ", linha ")}
                            </option>
                          ))}
                          <option value="EXCLUIR">Excluir a escola desta importação</option>
                        </select>
                      </div>
                    );
                  })}
                </section>
              )}

              {(ambiguous.length > 0 || invalid.length > 0 || precision.length > 0 || decisions.acceptRounding) && (
                <section>
                  <div className="section-title">4. Células</div>
                  {(precision.length > 0 || decisions.acceptRounding) && (
                    <label style={{ display: "block", fontSize: 13 }}>
                      <input type="checkbox" checked={decisions.acceptRounding} onChange={(e) => patch({ acceptRounding: e.target.checked })} /> Aceito
                      arredondar para 2 casas decimais (meio para cima) {precision.length > 0 ? `as ${precision.length} célula(s) com mais casas` : "as células com mais casas"} — ex.:{" "}
                      {precision[0]?.message.split(";")[0] ?? "7,568 → 7,57"}.
                    </label>
                  )}
                  {ambiguous.map((p) => {
                    const [sheetName] = p.key.split("!");
                    const options = p.message.match(/pode ser ([\d.]+) ou ([\d.]+)/);
                    return (
                      <div key={p.key} style={{ ...SMALL, marginTop: 6 }}>
                        {sheetName} {p.where}: {p.message}{" "}
                        {options && (
                          <select value="" onChange={(e) => patchRecord("cellValue", { [p.key]: e.target.value === "__EXCLUIR" ? null : Number(e.target.value) })} aria-label={`Valor de ${p.where}`}>
                            <option value="">— escolher —</option>
                            <option value={options[1]}>{options[1]}</option>
                            <option value={options[2]}>{options[2]}</option>
                            <option value="__EXCLUIR">Excluir</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                  {invalidGroups.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={SMALL}>{invalid.length} célula(s) inválida(s) não serão importadas (nunca viram zero) — ver onde</summary>
                      <ul style={SMALL}>
                        {invalidGroups.map((g) => (
                          <li key={g.reason}>
                            {g.reason} — {g.where.length} célula(s): {g.where.slice(0, 12).join(", ")}
                            {g.where.length > 12 ? "…" : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}

              {belowReturn.length > 0 && (
                <section>
                  <div className="section-title" style={RED}>
                    Obrigatório: pedidos abaixo da devolução já lançada
                  </div>
                  {belowReturn.map((p) => (
                    <p key={p.key} style={SMALL}>
                      {p.message}{" "}
                      <button type="button" className="btn-tiny" onClick={() => patchRecord("excludedLines", { [p.key]: true })}>
                        Excluir este item
                      </button>
                    </p>
                  ))}
                </section>
              )}

              <section>
                <div className="section-title">5. Reconciliação</div>
                <div className="table-scroll">
                  <table>
                    <tbody>
                      <tr>
                        <td>Células de Pedido preenchidas nas abas marcadas (origem)</td>
                        <td className="mono">{plan.reconciliation.sourceCells}</td>
                      </tr>
                      <tr>
                        <td>Fora da oferta ativa / produto não reconhecido</td>
                        <td className="mono">{plan.reconciliation.outOfOfferCells}</td>
                      </tr>
                      <tr>
                        <td>Pendentes (aguardando decisão ou inválidas — não entram)</td>
                        <td className="mono" style={plan.reconciliation.pendingCells ? RED : undefined}>
                          {plan.reconciliation.pendingCells}
                        </td>
                      </tr>
                      <tr>
                        <td>Excluídas por decisão</td>
                        <td className="mono">{plan.reconciliation.excludedByDecisionCells}</td>
                      </tr>
                      <tr>
                        <td>Importáveis (entram no plano)</td>
                        <td className="mono">{plan.reconciliation.importedCells}</td>
                      </tr>
                      <tr>
                        <td>Linhas de escola: reconhecidas / pendentes / excluídas</td>
                        <td className="mono">
                          {plan.reconciliation.schoolRows.recognized} / {plan.reconciliation.schoolRows.pending} / {plan.reconciliation.schoolRows.excluded}
                        </td>
                      </tr>
                      <tr style={{ fontWeight: 700 }}>
                        <td>A gravar: pedidos (escola × produto) e quantidade total em kg</td>
                        <td className="mono">
                          {plan.reconciliation.confirmedLines} — {formatQtyNumber(plan.reconciliation.confirmedQty)} kg
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div className="section-title">6. O que muda nos pedidos deste ciclo</div>
                <div className="toolbar">
                  {(["TODAS", "NOVO", "ALTERACAO", "ZERAR"] as const).map((c) => (
                    <button key={c} type="button" className={`filter-chip${changeFilter === c ? " active" : ""}`} onClick={() => setChangeFilter(c)}>
                      {c === "TODAS" ? "Todas" : CHANGE_LABEL[c]} ({c === "TODAS" ? plan.reconciliation.confirmedLines : plan.reconciliation.changes[c]})
                    </button>
                  ))}
                  <span className="filter-chip">Sem mudança: {plan.reconciliation.changes.SEM_MUDANCA}</span>
                </div>
                <div className="table-scroll" style={{ maxHeight: 420 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Escola</th>
                        <th>Produto</th>
                        <th>Atual → novo</th>
                        <th>Tipo</th>
                        <th>Origem</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.slice(0, lineLimit).map((l) => {
                        const s = schoolById.get(l.schoolId);
                        const p = productById.get(l.productId);
                        return (
                          <tr key={lineKey(l.schoolId, l.productId)}>
                            <td className="name-cell">
                              <span className="code-tag">{s?.code}</span> {s?.name}
                            </td>
                            <td>{p?.name}</td>
                            <td className="mono">
                              {l.currentQty === null ? "—" : formatQtyNumber(l.currentQty)} → <strong>{formatQtyNumber(l.newQty)}</strong> {p?.unit}
                            </td>
                            <td style={l.change === "ZERAR" || (l.currentQty !== null && l.newQty < l.currentQty) ? RED : undefined}>
                              {CHANGE_LABEL[l.change]}
                              {l.change === "ALTERACAO" && l.currentQty !== null && l.newQty < l.currentQty ? " (redução)" : ""}
                            </td>
                            <td className="stat-sub">{l.sources.join(", ")}</td>
                            <td>
                              <button type="button" className="btn-tiny" onClick={() => patchRecord("excludedLines", { [lineKey(l.schoolId, l.productId)]: true })}>
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleLines.length > lineLimit && (
                  <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", marginTop: 6 }} onClick={() => setShowAllLines(true)}>
                    Mostrar todas as {visibleLines.length} linhas
                  </button>
                )}
                {Object.keys(decisions.excludedLines).length > 0 && (
                  <p style={SMALL}>
                    {Object.keys(decisions.excludedLines).length} item(ns) excluído(s) por você.{" "}
                    <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => patch({ excludedLines: {} })}>
                      Desfazer
                    </button>
                  </p>
                )}
              </section>

              <section style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
                  <input type="checkbox" checked={decisions.acknowledgeExclusions} onChange={(e) => patch({ acknowledgeExclusions: e.target.checked })} /> Estou
                  ciente de que {plan.reconciliation.pendingCells + plan.reconciliation.excludedByDecisionCells} célula(s) pendente(s) ou excluída(s) e{" "}
                  {plan.reconciliation.outOfOfferCells} fora da oferta <strong>não</strong> serão gravadas (importação parcial).
                </label>
                {plan.confirmBlockers.length > 0 && (
                  <ul style={{ ...SMALL, ...RED }}>
                    {plan.confirmBlockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn-primary" disabled={!plan.canConfirm || busy} onClick={handleConfirm}>
                  {busy ? "Gravando…" : `Gravar ${plan.reconciliation.confirmedLines} pedido(s) na Semana ${week?.number ?? ""}`}
                </button>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
