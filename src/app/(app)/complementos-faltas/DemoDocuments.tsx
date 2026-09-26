"use client";

import { useState } from "react";
import { CYCLE_CORE_REPORTS } from "@/lib/cycleCore/documents";
import type { CycleLedger } from "@/lib/domain/cycleLedger";

// Documentos da demonstração, montados com o estado atual da tela (em
// memória). O servidor valida os dados e devolve o PDF; nada é gravado.
export function DemoDocuments({ ledger }: { ledger: CycleLedger }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(path: string, id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/demonstracao/documentos/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível gerar o documento.");
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "documento.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o documento.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }} aria-label="Documentos da demonstração">
      <strong style={{ fontSize: 15 }}>Documentos pela lógica corrigida (demonstração)</strong>
      <p className="stat-sub" style={{ margin: 0 }}>
        Gerados com os números desta tela, com a faixa &quot;DEMONSTRAÇÃO&quot; em todas as páginas. Os documentos oficiais de cada semana continuam na
        página da semana, pelo modelo atual. &quot;Pedidos aos Produtores&quot; não muda de fonte e por isso não aparece aqui.
      </p>
      <div className="quick-grid">
        {CYCLE_CORE_REPORTS.map((r) => (
          <button key={r.key} type="button" className="quick-btn" disabled={busy !== null} onClick={() => download(r.key, r.key)}>
            <div className="qb-label">{busy === r.key ? "Gerando…" : r.label}</div>
          </button>
        ))}
      </div>
      <div className="rm-actions">
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => download("zip", "zip")}>
          {busy === "zip" ? "Gerando…" : "Baixar tudo (.zip)"}
        </button>
        <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => download("romaneios-escolas?vias=4", "vias")}>
          {busy === "vias" ? "Gerando…" : "Romaneios em 4 vias"}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--brick)", margin: 0, fontSize: 13 }}>
          {error}
        </p>
      )}
    </section>
  );
}
