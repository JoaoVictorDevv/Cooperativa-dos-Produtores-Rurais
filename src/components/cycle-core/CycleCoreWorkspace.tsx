"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { summarizeCycle } from "@/lib/domain/cycle";
import { cycleInput, ledgerClosingPreview, type Actor, type CycleCommand, type CycleLedger } from "@/lib/domain/cycleLedger";
import type { CycleCoreRepository } from "@/lib/cycleCore/repository";
import { ClosingPreviewPanel } from "./ClosingPreviewPanel";
import { SchoolLinePanel } from "./SchoolLinePanel";
import { fmtDateTime, type CycleCoreNames } from "./labels";

type Filter = "TODAS" | "PENDENTES" | "FALTAS";

// Área de trabalho de complementos e faltas de um ciclo. Recebe o repositório
// por parâmetro: hoje o de memória (demonstração); depois, o adaptador da API
// do Lucas — sem mudar esta tela.
export function CycleCoreWorkspace(props: {
  repository: CycleCoreRepository;
  cycleId: string;
  actor: Actor;
  names: CycleCoreNames;
  producerIds: string[];
  reasonOptions: string[];
}) {
  const { repository, cycleId } = props;
  const [ledger, setLedger] = useState<CycleLedger | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("TODAS");

  const reload = useCallback(async () => {
    try {
      setLedger(await repository.load(cycleId));
      setLoadError(null);
    } catch {
      setLoadError("Não foi possível carregar o ciclo.");
    }
  }, [repository, cycleId]);

  useEffect(() => {
    let alive = true;
    repository.load(cycleId).then(
      (l) => alive && setLedger(l),
      () => alive && setLoadError("Não foi possível carregar o ciclo."),
    );
    return () => {
      alive = false;
    };
  }, [repository, cycleId]);

  const onCommand = useCallback(
    async (command: CycleCommand) => {
      const r = await repository.execute(cycleId, command, props.actor);
      if (r.ok) setLedger(r.ledger);
      else if (r.code === "CONFLITO") await reload();
      return r;
    },
    [repository, cycleId, props.actor, reload],
  );

  const summary = useMemo(() => (ledger ? summarizeCycle(cycleInput(ledger)) : null), [ledger]);
  const preview = useMemo(() => (ledger ? ledgerClosingPreview(ledger) : null), [ledger]);

  if (loadError) return <p role="alert">{loadError}</p>;
  if (!ledger || !summary || !preview) return <p className="stat-sub">Carregando…</p>;

  const readOnly = ledger.status === "FECHADO" || props.actor.role === "CONSULTA";
  const lines = summary.schoolLines
    .filter((l) => l.receiptStatus !== "SEM_PEDIDO")
    .filter((l) => (filter === "PENDENTES" ? !l.readyToClose : filter === "FALTAS" ? l.shortageQty > 0 : true));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      <ClosingPreviewPanel preview={preview} summary={summary} names={props.names} />

      <div className="toolbar">
        {(
          [
            ["TODAS", "Todas as linhas"],
            ["PENDENTES", "Com pendência"],
            ["FALTAS", "Com falta"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" className={`filter-chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
        {readOnly && <span className="stat-sub">Somente consulta.</span>}
      </div>

      {lines.map((line) => (
        <SchoolLinePanel
          key={`${line.schoolId}:${line.productId}`}
          ledger={ledger}
          line={line}
          actor={props.actor}
          names={props.names}
          producerIds={props.producerIds}
          reasonOptions={props.reasonOptions}
          readOnly={readOnly}
          onCommand={onCommand}
        />
      ))}
      {lines.length === 0 && <p className="stat-sub">Nenhuma linha neste filtro.</p>}

      <details className="card" style={{ padding: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Auditoria ({ledger.audit.length})</summary>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Escola / produto</th>
                <th>Antes</th>
                <th>Depois</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {[...ledger.audit].reverse().map((a, i) => (
                <tr key={i}>
                  <td>{fmtDateTime(a.at)}</td>
                  <td>{a.actorId}</td>
                  <td className="code-tag">{a.action}</td>
                  <td>
                    {props.names.schools[a.schoolId] ?? a.schoolId} — {props.names.products[a.productId] ?? a.productId}
                  </td>
                  <td className="code-tag">{a.before ? JSON.stringify(a.before) : "—"}</td>
                  <td className="code-tag">{a.after ? JSON.stringify(a.after) : "—"}</td>
                  <td>{a.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
