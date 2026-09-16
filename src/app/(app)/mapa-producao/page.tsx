import { prisma } from "@/lib/prisma";

type MonthKey = "out" | "nov" | "dez" | "jan" | "fev" | "mar" | "abr" | "mai" | "jun" | "jul" | "ago" | "set";

const MONTHS: { key: MonthKey; label: string }[] = [
  { key: "out", label: "Out" },
  { key: "nov", label: "Nov" },
  { key: "dez", label: "Dez" },
  { key: "jan", label: "Jan" },
  { key: "fev", label: "Fev" },
  { key: "mar", label: "Mar" },
  { key: "abr", label: "Abr" },
  { key: "mai", label: "Mai" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "ago", label: "Ago" },
  { key: "set", label: "Set" },
];

async function getEntries() {
  return prisma.productionMapEntry.findMany({
    include: { product: true, producer: true },
    orderBy: [{ product: { name: "asc" } }, { producer: { name: "asc" } }],
  });
}

// CA-MAPA-01..05: so consulta — referencia do plano anual (ciclo PNAE
// out-set), usada para decidir a divisao do pedido entre produtores.
export default async function MapaProducaoPage() {
  const entries = await getEntries();
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const byProduct = new Map<string, { productName: string; rows: typeof entries }>();
  for (const p of products) {
    byProduct.set(p.id, { productName: p.name, rows: [] });
  }
  for (const e of entries) {
    byProduct.get(e.productId)?.rows.push(e);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">REFERÊNCIA · CICLO OUT–SET</div>
          <div className="page-title display">Mapa de Produção</div>
        </div>
      </div>
      <p className="table-foot-note" style={{ textAlign: "left" }}>
        Plano anual de cada produtor (Projeto de Venda PNAE). Use como referência para dividir o pedido — alterar aqui
        nunca afeta semanas já lançadas.
      </p>

      {[...byProduct.values()].map((group) => (
        <div key={group.productName} style={{ marginBottom: 26 }}>
          <div className="section-title">{group.productName}</div>
          {group.rows.length === 0 ? (
            <div className="card" style={{ padding: 16, color: "var(--ink-soft)", fontSize: 13 }}>
              ⚠ Nenhum produtor cadastrado para este produto no plano anual.
            </div>
          ) : (
            <div className="card table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produtor</th>
                    {MONTHS.map((m) => (
                      <th key={m.key} style={{ width: 60 }}>
                        {m.label}
                      </th>
                    ))}
                    <th style={{ width: 90 }}>Total ano</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r) => {
                    const total = MONTHS.reduce((s, m) => s + Number(r[m.key]), 0);
                    return (
                      <tr key={r.id}>
                        <td className="name-cell">{r.producer.name}</td>
                        {MONTHS.map((m) => (
                          <td key={m.key} className="mono">
                            {Number(r[m.key]) || "—"}
                          </td>
                        ))}
                        <td className="mono">
                          <strong>{total.toFixed(0)} kg</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
