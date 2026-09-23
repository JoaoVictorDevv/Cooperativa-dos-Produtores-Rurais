import { describe, expect, it } from "vitest";
import { buildImportPreview, type KnownProduct, type KnownSchool } from "./importSchoolOrders";

const schools: KnownSchool[] = [
  { id: "s1", code: "4005", name: "Escola A" },
  { id: "s2", code: "4007", name: "Escola B" },
];
const products: KnownProduct[] = [
  { id: "p1", slug: "abacate", name: "Abacate" },
  { id: "p2", slug: "couve-manteiga", name: "Couve manteiga" },
];

function withHeader(rows: (string | number | null)[][]) {
  return [["CÓDIGO", "ESCOLA", "Abacate", "Couve manteiga"], ...rows];
}

describe("buildImportPreview — casos basicos", () => {
  it("reconhece escola e produto certinhos, incluindo virgula decimal", () => {
    const result = buildImportPreview(withHeader([["4005", "Escola A", "10,5", 3]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(2);
    expect(result.matchedRows[0]).toMatchObject({ schoolCode: "4005", productSlug: "abacate", orderedQty: 10.5 });
    expect(result.matchedRows[1]).toMatchObject({ schoolCode: "4005", productSlug: "couve-manteiga", orderedQty: 3 });
    expect(result.unmatchedSchoolCodes).toHaveLength(0);
    expect(result.unmatchedProductColumns).toHaveLength(0);
    expect(result.invalidCells).toHaveLength(0);
  });

  it("celula vazia nao gera pedido nenhum (nao e erro, nao e zero)", () => {
    const result = buildImportPreview(withHeader([["4005", "Escola A", "", null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.invalidCells).toHaveLength(0);
  });

  it("nome de produto com acentuacao/caixa diferentes ainda casa", () => {
    const rows = [["CÓDIGO", "ESCOLA", "abacate", "COUVE MANTEIGA"], ["4005", "Escola A", 5, 2]];
    const result = buildImportPreview(rows, schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(2);
  });

  it("codigo de escola com espacos ou .0 sobrando ainda casa", () => {
    const result = buildImportPreview(withHeader([[" 4005 ", "Escola A", 5, null], ["4007.0", "Escola B", 1, null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(2);
    expect(result.matchedRows.map((r) => r.schoolCode).sort()).toEqual(["4005", "4007"]);
  });
});

describe("buildImportPreview — nao adivinha, nao transforma erro em zero", () => {
  it("codigo de escola desconhecido vira pendencia, nao e ignorado nem zerado", () => {
    const result = buildImportPreview(withHeader([["9999", "Escola Fantasma", 5, null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.unmatchedSchoolCodes).toEqual([{ rowIndex: 1, rawCode: "9999", rawName: "Escola Fantasma" }]);
  });

  it("coluna de produto nao reconhecida fica pendente, nao e associada a nenhum produto por adivinhacao", () => {
    const rows = [["CÓDIGO", "ESCOLA", "Abacate", "Produto Novo Que Nao Existe"], ["4005", "Escola A", 5, 3]];
    const result = buildImportPreview(rows, schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.unmatchedProductColumns).toEqual([{ colIndex: 3, label: "Produto Novo Que Nao Existe" }]);
    // a coluna reconhecida (Abacate) ainda e processada normalmente
    expect(result.matchedRows).toHaveLength(1);
    expect(result.matchedRows[0].productSlug).toBe("abacate");
  });

  it("celula com texto invalido vira pendencia, nunca vira pedido de zero", () => {
    const result = buildImportPreview(withHeader([["4005", "Escola A", "abacates demais", null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.invalidCells).toHaveLength(1);
    expect(result.invalidCells[0]).toMatchObject({ schoolCodeRaw: "4005", productColumnLabel: "Abacate" });
  });

  it("quantidade negativa vira pendencia", () => {
    const result = buildImportPreview(withHeader([["4005", "Escola A", -5, null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.invalidCells).toHaveLength(1);
  });

  it("codigo de escola duplicado no arquivo e ambiguo — exclui as duas linhas em vez de escolher uma", () => {
    const result = buildImportPreview(
      withHeader([
        ["4005", "Escola A", 5, null],
        ["4005", "Escola A", 8, null],
      ]),
      schools,
      products,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.duplicateSchoolCodes).toEqual([{ code: "4005", rowIndexes: [1, 2] }]);
  });

  it("linha de total/subtotal e ignorada, nao vira 'escola desconhecida'", () => {
    const result = buildImportPreview(withHeader([["", "TOTAL GERAL", 500, 300]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.unmatchedSchoolCodes).toHaveLength(0);
    expect(result.ignoredRows).toHaveLength(1);
    expect(result.ignoredRows[0].reason).toMatch(/total/i);
  });

  it("linha totalmente em branco e ignorada silenciosamente", () => {
    const result = buildImportPreview(withHeader([["", "", null, null]]), schools, products);
    if ("error" in result) throw new Error(result.error);
    expect(result.matchedRows).toHaveLength(0);
    expect(result.unmatchedSchoolCodes).toHaveLength(0);
    expect(result.ignoredRows).toHaveLength(0);
  });

  it("sem uma linha de cabecalho reconhecivel, devolve erro explicito", () => {
    const result = buildImportPreview([["x", "y"], ["1", "2"]], schools, products);
    expect("error" in result).toBe(true);
  });
});
