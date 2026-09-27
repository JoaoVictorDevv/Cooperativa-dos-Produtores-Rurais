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
        <strong>Prévia das regras confirmadas com o Seu Paulo, antes do banco novo.</strong>
        <span>
          Esta tela mostra como vão funcionar a conferência na escola, os complementos no mesmo ciclo e o encerramento de faltas. As escolas, os
          produtores e os números são inventados e ficam só neste navegador: ao recarregar, tudo volta ao início. Os pedidos, entregas e valores
          oficiais continuam nas telas de sempre.
        </span>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Roteiro sugerido para apresentar (5 minutos)</summary>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20, display: "grid", gap: 4 }}>
            <li>
              <strong>Escola Exemplo A</strong> pediu 200 kg de alface; chegaram 180 e a escola rejeitou 10. Aceito 170, falta 30. Registre um{" "}
              <em>complemento</em> de 30 do Produtor Exemplo 2 em <em>outra viagem</em> (a falta some) — ou <em>encerre a falta</em> com um motivo.
            </li>
            <li>
              <strong>Escola Exemplo B</strong> recebeu um complemento de 20, mas a entrega inicial nunca foi conferida: fica pendente. Registre a
              entrega inicial como 0 (nada chegou): aparece a falta de 10, que pode ser encerrada.
            </li>
            <li>
              <strong>Escola Exemplo C</strong> recebeu 5 kg a mais: o excedente aparece e não é cortado nem compensa a falta de outra escola.
            </li>
            <li>
              <strong>Escola Exemplo D</strong> ainda não tem nada registrado: vazio não é zero. Registre a entrega de 40. Se 15 dela vieram do Produtor
              Exemplo 2 na mesma carga, registre também um complemento de 15 <em>na mesma viagem</em>: o romaneio continua um só, com 40.
            </li>
            <li>
              Acompanhe no topo a <em>situação do ciclo</em> até &quot;Pronto para fechar&quot;, e baixe os documentos (um romaneio por escola e visita,
              com romaneio próprio só para complemento de outra viagem; entregas e atendimento; balanço pelo aceito na escola).
            </li>
          </ol>
        </details>
        <span className="stat-sub">
          Para funcionar de verdade falta o banco guardar a entrega de cada escola por produto, os complementos e as decisões de falta, com as
          mesmas checagens no servidor (parte do Lucas).
        </span>
      </div>
      <DemoWorkspace actor={{ id: user.name, role: user.role }} />
    </>
  );
}
