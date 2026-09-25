"use client";

import { useState, useTransition } from "react";
import { previewSchoolOrdersImport, confirmSchoolOrdersImport } from "@/app/actions/schoolOrdersImport";
import { formatQty } from "@/lib/format";
import type { ImportPreview } from "@/lib/importSchoolOrders";

// Importacao de pedido da prefeitura em Excel (plano §13): le e confere
// no servidor, mostra uma previa completa (o que foi reconhecido e o que
// precisa de atencao) e so grava depois de confirmacao explicita.
export function ImportSchoolOrders({ weekId }: { weekId: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [existingOrders, setExistingOrders] = useState<Record<string, number>>({});
  const [sourceLabel, setSourceLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    setSavedCount(null);
    setPreview(null);
    const fd = new FormData();
    fd.set("weekId", weekId);
    fd.set("file", file);
    startTransition(async () => {
      const r = await previewSchoolOrdersImport(fd);
      if (!r.ok || !r.preview) {
        setError(r.error ?? "Erro ao ler o arquivo.");
        return;
      }
      setPreview(r.preview);
      setExistingOrders(r.existingOrders ?? {});
      setSourceLabel(r.sourceLabel ?? file.name);
    });
  }

  function handleConfirm() {
    if (!preview) return;
    setError(null);
    const rows = preview.matchedRows.map((r) => ({ schoolId: r.schoolId, productId: r.productId, orderedQty: r.orderedQty }));
    startTransition(async () => {
      const r = await confirmSchoolOrdersImport(weekId, rows, sourceLabel);
      if (!r.ok) {
        setError(r.error ?? "Erro ao gravar a importação.");
        return;
      }
      setSavedCount(r.savedCount ?? 0);
      setPreview(null);
    });
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <button type="button" className="link-action" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        {open ? "− Fechar importação de Excel" : "+ Importar pedido da prefeitura (Excel)"}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <input
            type="file"
            accept=".xlsx"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {pending && <p className="stat-sub">Lendo e conferindo o arquivo…</p>}
          {error && (
            <p style={{ color: "#8B3A2E", fontSize: 13.5, marginTop: 8 }} role="alert">
              {error}
            </p>
          )}
          {savedCount !== null && (
            <p style={{ color: "var(--forest)", fontSize: 13.5, marginTop: 8 }}>
              {savedCount} linha(s) importada(s) e gravada(s) com sucesso.
            </p>
          )}

          {preview && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13 }}>
                Arquivo: <strong>{sourceLabel}</strong>
              </p>

              <div className="toolbar">
                <div className="filter-chip">{preview.matchedRows.length} linha(s) reconhecida(s)</div>
                {preview.unmatchedSchoolCodes.length > 0 && (
                  <div className="filter-chip" style={{ color: "#8B3A2E", borderColor: "#E9C6BC" }}>
                    {preview.unmatchedSchoolCodes.length} código(s) de escola não encontrados
                  </div>
                )}
                {preview.unmatchedProductColumns.length > 0 && (
                  <div className="filter-chip" style={{ color: "#8B3A2E", borderColor: "#E9C6BC" }}>
                    {preview.unmatchedProductColumns.length} coluna(s) não reconhecidas
                  </div>
                )}
                {preview.inactiveProductColumns.length > 0 && (
                  <div className="filter-chip" style={{ color: "#7a5c0a", borderColor: "var(--wheat-soft)" }}>
                    {preview.inactiveProductColumns.length} coluna(s) de produto fora do fluxo ativo
                  </div>
                )}
                {preview.duplicateSchoolCodes.length > 0 && (
                  <div className="filter-chip" style={{ color: "#8B3A2E", borderColor: "#E9C6BC" }}>
                    {preview.duplicateSchoolCodes.length} código(s) duplicado(s) (não importados)
                  </div>
                )}
                {preview.invalidCells.length > 0 && (
                  <div className="filter-chip" style={{ color: "#8B3A2E", borderColor: "#E9C6BC" }}>
                    {preview.invalidCells.length} célula(s) inválida(s)
                  </div>
                )}
                {preview.ignoredRows.length > 0 && <div className="filter-chip">{preview.ignoredRows.length} linha(s) ignoradas (total/subtotal)</div>}
              </div>

              {preview.unmatchedSchoolCodes.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>Códigos de escola não encontrados no cadastro — corrija na planilha ou lance manualmente</summary>
                  <ul style={{ fontSize: 12.5 }}>
                    {preview.unmatchedSchoolCodes.map((u, i) => (
                      <li key={i}>
                        Linha {u.rowIndex + 1}: código &quot;{u.rawCode}&quot; ({u.rawName || "sem nome na planilha"})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.unmatchedProductColumns.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>Colunas de produto não reconhecidas — o nome precisa bater com o cadastro</summary>
                  <ul style={{ fontSize: 12.5 }}>
                    {preview.unmatchedProductColumns.map((u, i) => (
                      <li key={i}>Coluna &quot;{u.label}&quot;</li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.inactiveProductColumns.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>Colunas de produto que não fazem mais parte do fluxo ativo da cooperativa</summary>
                  <ul style={{ fontSize: 12.5 }}>
                    {preview.inactiveProductColumns.map((u, i) => (
                      <li key={i}>
                        Coluna &quot;{u.label}&quot; corresponde a <strong>{u.productName}</strong>, que está desativado — essas
                        quantidades não serão importadas.
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.invalidCells.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>Células com valor que não deu para interpretar</summary>
                  <ul style={{ fontSize: 12.5 }}>
                    {preview.invalidCells.map((c, i) => (
                      <li key={i}>
                        Linha {c.rowIndex + 1}, escola {c.schoolCodeRaw}, {c.productColumnLabel}: &quot;{c.rawValue}&quot; — {c.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.duplicateSchoolCodes.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary>Códigos de escola duplicados no arquivo (nenhuma das linhas foi importada)</summary>
                  <ul style={{ fontSize: 12.5 }}>
                    {preview.duplicateSchoolCodes.map((d, i) => (
                      <li key={i}>
                        Código &quot;{d.code}&quot; aparece nas linhas {d.rowIndexes.map((r) => r + 1).join(", ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {preview.matchedRows.length > 0 && (
                <div className="card table-scroll" style={{ maxHeight: 320, marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Escola</th>
                        <th>Produto</th>
                        <th>Valor atual</th>
                        <th>Novo valor (da importação)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.matchedRows.map((r, i) => {
                        const prev = existingOrders[`${r.schoolId}:${r.productId}`] ?? 0;
                        const changed = prev !== r.orderedQty;
                        return (
                          <tr key={i}>
                            <td className="code-tag">{r.schoolCode}</td>
                            <td>{r.schoolName}</td>
                            <td>{r.productName}</td>
                            <td className="mono">{formatQty(prev, r.productSlug)}</td>
                            <td className="mono" style={changed ? { fontWeight: 700 } : undefined}>
                              {formatQty(r.orderedQty, r.productSlug)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.matchedRows.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <button className="btn-primary" onClick={handleConfirm} disabled={pending}>
                    {pending ? "Salvando…" : `Confirmar e importar ${preview.matchedRows.length} linha(s)`}
                  </button>
                  <p className="table-foot-note" style={{ textAlign: "left" }}>
                    Reenviar o mesmo arquivo substitui os valores anteriores dessas escolas/produtos — não soma.
                    Linhas com pendência (código ou coluna não reconhecidos, célula inválida, código duplicado) não
                    são importadas; corrija a planilha e reenvie, ou lance essas manualmente na tabela.
                  </p>
                </div>
              ) : (
                <p style={{ marginTop: 12, fontSize: 13.5 }}>Nenhuma linha reconhecida para importar neste arquivo.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
