import { kg2 } from "@/lib/coop/numeros";
import type { ResultadoSemana } from "@/lib/coop/motor";
import type { Cadastro, DiaRota, Semana } from "@/lib/coop/tipos";

// Escolas que não receberam no dia (fechadas etc.) e vão de novo neste dia,
// por outra rota, com o mesmo romaneio.
export function reentregasDoDia(cad: Cadastro, sem: Semana, dia: DiaRota) {
  const escolas = new Map(cad.escolas.map((e) => [e.codigo, e]));
  return Object.entries(sem.reentregas ?? {})
    .filter(([, re]) => re.dia === dia && !re.feita)
    .map(([codigo, re]) => ({ codigo, re, escola: escolas.get(codigo), rota: sem.rotas.find((r) => r.id === re.rota) }))
    .filter((x) => x.escola);
}

export function Reentregas({ cad, sem, r, dia, impresso = false }: { cad: Cadastro; sem: Semana; r: ResultadoSemana; dia: DiaRota; impresso?: boolean }) {
  const lista = reentregasDoDia(cad, sem, dia);
  if (!lista.length) return null;
  const nomeRota = (id: string) => (id === "MOTO" ? "Moto (avulso)" : id === "CARRO" ? "Carro da cooperativa" : id.endsWith("MOTOBOY") ? "Motoboy" : (sem.rotas.find((x) => x.id === id)?.titulo.split(" — ")[1]?.split(" · ").slice(0, 2).join(" · ") ?? id));
  const tabela = (
    <table className={impresso ? undefined : "tabela"}>
      <thead>
        <tr>
          <th>Cód.</th>
          <th>Escola</th>
          <th>Motivo</th>
          <th>Vai por</th>
          <th>Levar (mesmo romaneio)</th>
        </tr>
      </thead>
      <tbody>
        {lista.map(({ codigo, re, escola }) => (
          <tr key={codigo}>
            <td>{codigo}</td>
            <td>
              <strong>{escola!.nome}</strong>
              <div className="discreto">{escola!.bairro}</div>
            </td>
            <td>
              {re.motivo}
              {re.quando ? ` · ${re.quando}` : ""}
            </td>
            <td>{nomeRota(re.rota)}</td>
            <td>
              {cad.produtos
                .filter((p) => (r.enviado[codigo]?.[p.nome] ?? 0) > 0.0001)
                .map((p) => `${p.nome} ${kg2(r.enviado[codigo][p.nome])} ${p.unidade}`)
                .join(" · ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (impresso)
    return (
      <div className="folha">
        <h3>Reentregas — {dia === "SEG" ? "segunda" : "terça"}</h3>
        <p className="linha-cab">Escolas que não receberam no dia da rota. Levar o romaneio já impresso.</p>
        {tabela}
      </div>
    );
  return (
    <section>
      <div className="rota-titulo" style={{ background: "#8a5a00" }}>REENTREGAS DE {dia === "SEG" ? "SEGUNDA" : "TERÇA"} — escolas que ficaram sem receber</div>
      <div className="rota-corpo rolar">{tabela}</div>
    </section>
  );
}
