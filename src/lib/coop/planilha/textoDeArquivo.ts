// Transforma um anexo (.txt, .csv, .xlsx, .docx) em texto, linha por linha,
// para a previsão ler. Só leitura.
import ExcelJS from "exceljs";
import JSZip from "jszip";

function valorCelula(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return `${String(v).replace(".", ",")} kg`; // tabela: a quantidade vem em kg
  if (typeof v === "object") {
    if ("result" in v) return valorCelula((v as { result: ExcelJS.CellValue }).result);
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text);
    if (v instanceof Date) return "";
  }
  return String(v);
}

const desfazerXml = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export async function textoDeArquivo(nome: string, dados: ArrayBuffer): Promise<string> {
  if (/\.(txt|csv)$/i.test(nome)) return new TextDecoder("utf-8").decode(dados).replace(/[;\t]/g, " ");
  if (/\.xlsx$/i.test(nome)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(dados);
    const linhas: string[] = [];
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        const v = Array.isArray(row.values) ? row.values.slice(1) : [];
        const t = v.map((c) => valorCelula(c as ExcelJS.CellValue).trim()).filter(Boolean).join("  ");
        if (t) linhas.push(t);
      });
    });
    return linhas.join("\n");
  }
  if (/\.docx$/i.test(nome)) {
    const zip = await JSZip.loadAsync(dados);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    // Cada parágrafo vira uma linha; numa tabela, cada linha da tabela vira uma linha.
    const texto = xml
      .replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (tr) => `${tr.replace(/<\/w:p>/g, " ").replace(/<\/w:tc>/g, "  ")}\n`)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:(tab|br)\/>/g, " ")
      .replace(/<[^>]+>/g, "");
    return desfazerXml(texto)
      .split("\n")
      .map((t) => t.replace(/[ \t]+$/g, "").trim())
      .filter(Boolean)
      .join("\n");
  }
  throw new Error("Esse tipo de arquivo o app não lê. Use .txt (conversa exportada do WhatsApp), .xlsx, .docx ou .csv — ou copie o texto e cole na caixa.");
}
