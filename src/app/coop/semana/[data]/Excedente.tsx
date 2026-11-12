import { kg2 } from "@/lib/coop/numeros";
import type { ExcedenteDia } from "@/lib/coop/motor";
import type { DiaRota, Rota } from "@/lib/coop/tipos";

// EXCEDENTE do MAPA DE MONTAGEM (MODELO v100, 09/11): uma página por dia.
// Folhas e repolho: soma no TOTAL de cada rota (1 a 4, sem a moto).
// Legumes: um pouco em cada escola que já leva o produto (menos de 0,1 kg = "—").
export function Excedente({
  dia,
  ex,
  rotas,
  unidade,
  impresso = false,
  comLegumes = false,
}: {
  dia: DiaRota;
  ex: ExcedenteDia;
  rotas: Rota[];
  unidade: (p: string) => string;
  impresso?: boolean;
  comLegumes?: boolean;
}) {
  const numeradas = rotas.filter((r) => r.dia === dia && /-\d+$/.test(r.id));
  const nomeDia = dia === "SEG" ? "SEGUNDA" : "TERÇA";
  const folhas = ex.folhas.filter((x) => x.total > 0.004);
  const legumes = ex.legumes.filter((x) => x.total > 0.004);
  const cls = impresso ? undefined : "tabela";
  const corpo = (
    <>
      <p
        className={impresso ? "linha-cab" : "discreto"}
        style={impresso ? undefined : { margin: "6px 10px" }}
      >
        FOLHAS e REPOLHO: soma no TOTAL da rota.{" "}
        {comLegumes
          ? "LEGUME: põe em CADA ESCOLA que já tem o legume."
          : "LEGUMES: NÃO colocar a mais (só o que está no mapa)."}{" "}
        Excedente de folha só depois que todos os produtores chegarem.
      </p>
      <table className={cls}>
        <thead>
          <tr>
            <th>🥬 FOLHAS + REPOLHO</th>
            <th className="n">TOTAL A MAIS</th>
            {numeradas.map((r) => (
              <th key={r.id} className="n">
                ROTA {r.id.split("-")[1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folhas.length === 0 && (
            <tr>
              <td colSpan={2 + numeradas.length} className="discreto">
                nada a mais
              </td>
            </tr>
          )}
          {folhas.map((x) => (
            <tr key={x.produto}>
              <td>{x.produto}</td>
              <td className="n">
                <strong>
                  {kg2(x.total)} {unidade(x.produto)}
                </strong>
              </td>
              {numeradas.map((r) => (
                <td key={r.id} className="n">
                  {x.porRota[r.id] !== undefined && x.porRota[r.id] > 0.004
                    ? kg2(x.porRota[r.id])
                    : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {comLegumes && (
        <table className={cls} style={{ marginTop: impresso ? 14 : 0 }}>
          <thead>
            <tr>
              <th>🥔 LEGUMES</th>
              <th className="n">TOTAL HOJE</th>
              <th className="n">POR ESCOLA</th>
              <th className="n">ESCOLAS</th>
            </tr>
          </thead>
          <tbody>
            {legumes.length === 0 && (
              <tr>
                <td colSpan={4} className="discreto">
                  nada a mais
                </td>
              </tr>
            )}
            {legumes.map((x) => (
              <tr key={x.produto}>
                <td>{x.produto}</td>
                <td className="n">
                  <strong>
                    {kg2(x.total)} {unidade(x.produto)}
                  </strong>
                </td>
                <td className="n">
                  {x.porEscola === null ? (
                    ""
                  ) : x.porEscola < 0.1 ? (
                    "—"
                  ) : (
                    <strong>{kg2(x.porEscola)}</strong>
                  )}
                </td>
                <td className="n">{x.escolas || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
  if (impresso)
    return (
      <div className="folha excedente">
        <h3>
          Excedente da {nomeDia} — pode ir A MAIS nas entregas de {nomeDia}
        </h3>
        {corpo}
      </div>
    );
  return (
    <section>
      <div className="rota-titulo">
        EXCEDENTE DA {nomeDia} — pode ir A MAIS nas entregas de{" "}
        {nomeDia.toLowerCase()}
      </div>
      <div className="rota-corpo rolar">{corpo}</div>
    </section>
  );
}
