import Link from "next/link";
import { lerSemana, listarSemanas } from "@/lib/coop/armazem";
import { somarDias } from "@/lib/coop/semana";
import { carregarCadastro } from "../dados";
import { NovaSemana } from "./NovaSemana";

export const metadata = { title: "Nova semana" };

export default async function Nova() {
  const cad = await carregarCadastro();
  if (!cad) {
    return (
      <p className="aviso">
        Primeiro traga o MODELO (v101) no <Link href="/coop/cadastro">Cadastro</Link>.
      </p>
    );
  }
  const datas = await listarSemanas();
  const ultima = datas.length ? await lerSemana(datas[0]) : null;
  return (
    <>
      <Link className="voltar" href="/coop">
        ← Semanas
      </Link>
      <h1>Nova semana</h1>
      <p className="sub">Chegou o pedido da Prefeitura: traga o arquivo, confira os cortes com a nutricionista e crie a semana.</p>
      <NovaSemana
        dataSugerida={ultima ? somarDias(ultima.data, 7) : ""}
        entregaSugerida={ultima ? ultima.entrega + 1 : 1}
        diasSugeridos={["DOMINGO", "SEGUNDA"]}
        semanas={datas}
        produtos={cad.produtos.map((p) => p.nome)}
      />
    </>
  );
}
