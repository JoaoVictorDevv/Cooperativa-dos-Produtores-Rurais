import { verifySession } from "@/lib/dal";
import { DemoWorkspace } from "./DemoWorkspace";

// Complementos e encerramento de faltas (spec 008, etapa 4) — DEMONSTRAÇÃO.
// As regras e a tela estão prontas, mas ainda não existe onde gravar entregas
// por escola/produto, complementos e decisões de falta (depende do Lucas; ver
// docs/propostas-pendentes.md §9). Aqui tudo roda em memória, com dados
// fictícios, e se perde ao recarregar a página.
export default async function ComplementosFaltasPage() {
  const user = await verifySession();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">DEMONSTRAÇÃO — DADOS FICTÍCIOS, NADA É GRAVADO</div>
          <div className="page-title display">Complementos e faltas</div>
        </div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: "3px solid var(--wheat)", fontSize: 13.5, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
        <strong>Prévia das regras confirmadas, antes do banco novo.</strong>
        <span>
          Esta tela mostra como vão funcionar a conferência na escola, os complementos no mesmo ciclo e o encerramento de faltas. Os números são
          inventados e ficam só neste navegador: ao recarregar, tudo volta ao início. Os pedidos, entregas e valores oficiais continuam nas telas
          de sempre.
        </span>
        <span className="stat-sub">
          Falta para funcionar de verdade: tabelas de entrega por escola/produto, complemento e decisão de falta, com validação no servidor
          (responsável: Lucas).
        </span>
      </div>
      <DemoWorkspace actor={{ id: user.name, role: user.role }} />
    </>
  );
}
