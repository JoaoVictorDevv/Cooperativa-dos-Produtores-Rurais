import { describe, expect, it } from "vitest";
import { lerDocumentoPrevisao } from "./previsao";

const produtores = [
  { id: "ana", nome: "Ana Claudia Correa Ruas de Souza", curto: "Ana" },
  { id: "gus", nome: "Gustavo de Mello Rodrigues", curto: "Gustavo" },
  { id: "mce", nome: "Marcelo Marcos Delgado", curto: "Marcelo" },
  { id: "mco", nome: "Marcos Marcelo Delgado", curto: "Marcos" },
];
const produtos = ["Alface lisa", "Couve manteiga", "Chuchu", "Cheiro verde"];

describe("lerDocumentoPrevisao", () => {
  it("lê a tabela da previsão (nome só na 1ª linha, total por produto ignorado, 1.400 = mil e quatrocentos)", () => {
    const doc = lerDocumentoPrevisao(
      ["TOTAL POR PRODUTO", "Chuchu 1.600 kg", "TOTAL 3.362 kg", "POR PRODUTOR", "Ana Couve manteiga 150 kg", "Alface lisa 200 kg", "Gustavo Chuchu 1.400 kg", "Marcos Cheiro verde 6 kg", "Marcelo e Marcos: dividido metade para cada."].join("\n"),
      produtores,
      produtos,
    );
    expect(doc.porProdutor.ana).toEqual([expect.objectContaining({ produto: "Couve manteiga", kg: 150 }), expect.objectContaining({ produto: "Alface lisa", kg: 200 })]);
    expect(doc.porProdutor.gus).toEqual([expect.objectContaining({ produto: "Chuchu", kg: 1400 })]);
    expect(doc.porProdutor.mco).toEqual([expect.objectContaining({ produto: "Cheiro verde", kg: 6 })]);
    expect(doc.porProdutor.mce).toBeUndefined();
    expect(doc.observacoes).toContain("Marcelo e Marcos: dividido metade para cada.");
  });

  it("lê a conversa exportada do WhatsApp e ignora as mensagens da cooperativa", () => {
    const doc = lerDocumentoPrevisao(
      ["[23/11/2026 09:12] Coop: Bom dia, Ana! O que vai ter pra 29/11? 100 kg", "[23/11/2026 10:15] Ana Claudia: 150kg couve e 200 alface", "24/11/2026 08:00 - Gustavo: 1.400 kg xuxu"].join("\n"),
      produtores,
      produtos,
    );
    expect(doc.porProdutor.ana).toEqual([expect.objectContaining({ produto: "Couve manteiga", kg: 150 }), expect.objectContaining({ produto: "Alface lisa", kg: 200 })]);
    expect(doc.porProdutor.gus).toEqual([expect.objectContaining({ produto: "Chuchu", kg: 1400 })]);
  });
});
