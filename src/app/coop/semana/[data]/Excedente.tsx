import { kg2 } from "@/lib/coop/numeros";
import type { ResultadoSemana } from "@/lib/coop/motor";
import type { Cadastro } from "@/lib/coop/tipos";

// Lista de EXCEDENTE do MAPA DE MONTAGEM (MODELO v100, linhas 280–301):
// o que chegou a mais e pode ir a mais nas escolas. Menos de 0,1 kg não
// aparece (é só arredondamento), igual à planilha a partir da v101.
export function Excedente({ cad, r, impresso = false }: { cad: Cadastro; r: ResultadoSemana; impresso?: boolean }) {
  const linhas = cad.produtos
    .map((p) => ({ p, e: r.entregaProduto[p.nome] }))
    .filter(({ e }) => e.pedidoSeg + e.pedidoTer > 0);
  const folha = (e: ResultadoSemana["entregaProduto"][string]) => e.planejado2 > 0.004;
  const tabela = (
    <table className={impresso ? undefined : "tabela"}>
      <thead>
        <tr>
          <th>Nº</th>
          <th>PRODUTO</th>
          <th className="n">A MAIS NA SEGUNDA</th>
          <th className="n">A MAIS NA TERÇA</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(({ p, e }, i) => (
          <tr key={p.nome}>
            <td>{i + 1}</td>
            <td>
              {p.nome} ({folha(e) ? "folha" : "legume"})
            </td>
            <td className="n">
              <strong>{e.excedente1 >= 0.1 ? `${kg2(e.excedente1)} ${p.unidade}` : ""}</strong>
            </td>
            <td className="n">
              <strong>{folha(e) ? (e.excedente2 >= 0.1 ? `${kg2(e.excedente2)} ${p.unidade}` : "") : "resto da segunda"}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const texto =
    "FOLHAS: vai TUDO, nada fica no galpão — o que chegou no 1º dia vai nas rotas de segunda, o que chegou no 2º dia vai nas rotas de terça. LEGUMES: é o que sobra depois de separar segunda e terça (pode ir em qualquer dia).";
  if (impresso)
    return (
      <div className="folha">
        <h3>Excedente — o que chegou a mais e pode ir a mais nas escolas</h3>
        <p className="linha-cab">{texto}</p>
        {tabela}
      </div>
    );
  return (
    <section>
      <div className="rota-titulo">EXCEDENTE — o que chegou a mais e pode ir a mais nas escolas</div>
      <div className="rota-corpo rolar">
        <p className="discreto" style={{ margin: "6px 10px" }}>
          {texto}
        </p>
        {tabela}
      </div>
    </section>
  );
}
