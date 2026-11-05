import { pastaDados } from "@/lib/coop/armazem";
import { kg } from "@/lib/coop/numeros";
import { telefoneWhatsApp } from "@/lib/coop/mensagens";
import { carregarCadastro } from "../dados";
import { ImportarModelo, ImportarSemana } from "./Importar";

export const metadata = { title: "Cadastro" };

export default async function Cadastro() {
  const cad = await carregarCadastro();
  return (
    <>
      <h1>Cadastro</h1>
      <p className="sub">
        Produtos, preços, produtores, escolas, rotas e Mapa de Produção vêm da planilha MODELO. Mudou algo no MODELO? É só trazer de novo. Os dados ficam em{" "}
        <code>{pastaDados()}</code>.
      </p>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>1. Trazer a planilha MODELO (v101)</h2>
        <ImportarModelo />
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>2. Trazer uma semana já feita na planilha (opcional)</h2>
        <p className="discreto">Ex.: controle_2026-10-26. Ela entra no histórico do app com tudo que foi digitado (entregas, retornos, custos).</p>
        <ImportarSemana />
      </div>
      {cad && (
        <>
          <div className="grade">
            <div className="numero">
              <small>Chamada / processo</small>
              <strong style={{ fontSize: 16 }}>
                {cad.chamada} · {cad.processo}
              </strong>
            </div>
            <div className="numero">
              <small>Taxa de logística</small>
              <strong>R$ {kg(cad.taxaLogistica)}/kg</strong>
            </div>
            <div className="numero">
              <small>Escolas</small>
              <strong>{cad.escolas.length}</strong>
            </div>
            <div className="numero">
              <small>Rotas</small>
              <strong>{cad.rotas.length}</strong>
            </div>
          </div>
          <h2>Produtores ({cad.produtores.length})</h2>
          <div className="card rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Chamado de</th>
                  <th>Telefone</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {cad.produtores.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.curto}</td>
                    <td>{p.telefone ?? "—"}</td>
                    <td>{telefoneWhatsApp(p.telefone) ? <span className="etiqueta verde">ok</span> : <span className="etiqueta vermelha">sem número</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Produtos e preços</h2>
          <div className="card rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="n">Preço Prefeitura</th>
                  <th className="n">Produtor recebe</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {cad.produtos.map((p) => (
                  <tr key={p.nome}>
                    <td>{p.nome}</td>
                    <td className="n">R$ {kg(p.preco)}</td>
                    <td className="n">R$ {kg(p.preco - cad.taxaLogistica)}</td>
                    <td>{p.doisDias ? "2 dias (folha)" : "1º dia"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Rotas</h2>
          <div className="card">
            {cad.rotas.map((r) => (
              <p key={r.id} style={{ margin: "4px 0" }}>
                <strong>{r.titulo}</strong> <span className="discreto">— {r.paradas.length} escolas</span>
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}
