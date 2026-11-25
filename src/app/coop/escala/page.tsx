import Link from "next/link";
import { escalaDe, gruposDoDia, juntarNomes } from "@/lib/coop/escala";
import { carregarCadastro } from "../dados";
import { BotaoImprimir } from "../ui";

export const metadata = { title: "Equipe do galpão" };

// Folha "Equipe do galpão" (igual à do João). Sem valores: a diária fica só no Cadastro.
export default async function FolhaEquipe() {
  const cad = await carregarCadastro();
  if (!cad) return <p className="aviso">Primeiro traga o MODELO no <Link href="/coop/cadastro">Cadastro</Link>.</p>;
  const e = escalaDe(cad);
  const chefe = e.dias.flatMap((d) => d.pessoas).find((p) => p.funcao === "chefe")?.nome;
  return (
    <>
      <div className="botoes nao-imprimir" style={{ marginBottom: 12 }}>
        <BotaoImprimir />
        <Link className="botao claro" href="/coop/cadastro">
          ← Voltar para o Cadastro (mudar a escala)
        </Link>
      </div>
      <div className="folha equipe" data-arquivo="equipe do galpao">
        <h3 className="equipe-titulo">Equipe do galpão</h3>
        <p className="equipe-sub">{cad.nomeCooperativa ?? "Cooperativa"} · Merenda escolar (PNAE)</p>
        {chefe && e.tarefasChefe.length > 0 && (
          <div className="equipe-chefe">
            <h4>👷 {chefe} — chefe do galpão</h4>
            <ul>
              {e.tarefasChefe.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {e.dias.map((d) => (
          <div key={d.dia} className="equipe-dia">
            <div className="equipe-dia-cab">{d.dia}</div>
            <div className="equipe-dia-corpo">
              {gruposDoDia(d.pessoas).map((g) => (
                <p key={`${g.funcao}-${g.hora}`}>
                  <strong>{g.funcao === "chefe" ? "Chefe:" : "Ajudantes do galpão:"}</strong> {juntarNomes(g.nomes)}
                  {g.hora && (
                    <>
                      {" "}
                      — {g.nomes.length > 1 ? "chegam" : "chega"} <strong>{g.hora}</strong>
                    </>
                  )}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
