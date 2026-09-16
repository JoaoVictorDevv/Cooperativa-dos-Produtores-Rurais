import { prisma } from "@/lib/prisma";
import { NewReasonForm } from "./NewReasonForm";
import { ToggleActive } from "./ToggleActive";

export default async function MotivosPage() {
  const reasons = await prisma.returnReason.findMany({ orderBy: { code: "asc" } });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">CADASTRO</div>
          <div className="page-title display">Motivos de devolução</div>
        </div>
      </div>

      <NewReasonForm />

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Código</th>
              <th>Descrição</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.id}>
                <td className="code-tag">{r.code}</td>
                <td>{r.description}</td>
                <td>
                  <span className={`badge ${r.active ? "ok" : "fechada"}`}>{r.active ? "ATIVO" : "INATIVO"}</span>
                </td>
                <td>
                  <ToggleActive id={r.id} active={r.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
