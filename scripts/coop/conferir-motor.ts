// Confere o motor do app com a planilha, célula por célula.
//
// Uso: npx tsx scripts/coop/conferir-motor.ts <semana.xlsx> <semana-recalculada.xlsx>
//   - semana.xlsx: a planilha da semana (de onde saem os dados digitados);
//   - semana-recalculada.xlsx: cópia recalculada pelo LibreOffice (só para
//     ler os resultados das fórmulas).
// Não grava nada.

import ExcelJS from "exceljs";
import { calcularSemana } from "../../src/lib/coop/motor";
import { lerPlanilha } from "../../src/lib/coop/planilha/lerPlanilha";

const [original, recalculada] = process.argv.slice(2);
if (!original || !recalculada) {
  console.error("Uso: npx tsx scripts/coop/conferir-motor.ts <semana.xlsx> <semana-recalculada.xlsx>");
  process.exit(2);
}

const TOL = 0.0051;

async function main() {
  const { cadastro, semana, avisos } = await lerPlanilha(original);
  avisos.forEach((a) => console.log("aviso:", a));
  const r = calcularSemana(cadastro, semana);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(recalculada);
  const val = (aba: string, ref: string | [number, number]): number => {
    const ws = wb.getWorksheet(aba)!;
    const c = Array.isArray(ref) ? ws.getCell(ref[0], ref[1]) : ws.getCell(ref);
    const v = c.value as unknown;
    const x = v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v;
    return typeof x === "number" ? x : x === "" || x === null || x === undefined ? 0 : Number(x) || 0;
  };

  const grupos: Record<string, { total: number; erros: string[] }> = {};
  const conf = (grupo: string, rotulo: string, nosso: number, planilha: number) => {
    const g = (grupos[grupo] ??= { total: 0, erros: [] });
    g.total++;
    if (Math.abs(nosso - planilha) > TOL) g.erros.push(`${rotulo}: app ${nosso.toFixed(4)} × planilha ${planilha.toFixed(4)}`);
  };

  const P = cadastro.produtos;
  cadastro.produtores.forEach((prod, j) => {
    P.forEach((p, i) => {
      conf("1 divisão calculada", `${prod.curto}/${p.nome}`, r.divisaoCalculada[prod.id][p.nome], val("_AUX_DIVISAO", [4 + 24 * i + j, 17]));
      conf("2 pedido ao produtor", `${prod.curto}/${p.nome}`, r.pedidoProdutor[prod.id][p.nome], val("Entrada de Dados", [210 + j, 3 + i]));
      const x = r.produtores[prod.id][p.nome];
      conf("3 planejado 1º/2º dia", `${prod.curto}/${p.nome} 1º`, x.planejado1, val(prod.id, [6 + i, 20]));
      conf("3 planejado 1º/2º dia", `${prod.curto}/${p.nome} 2º`, x.planejado2, val(prod.id, [6 + i, 21]));
      conf("8 pagamento produtor (kg)", `${prod.curto}/${p.nome}`, x.pagoKg, val(prod.id, [6 + i, 11]));
      conf("9 pagamento produtor (R$)", `${prod.curto}/${p.nome}`, x.valor, val(prod.id, [6 + i, 7]));
    });
    conf("9 pagamento produtor (R$)", `${prod.curto} TOTAL`, r.pagarProdutor[prod.id], val(prod.id, "G25"));
  });

  P.forEach((p, i) => {
    const e = r.entregaProduto[p.nome];
    const col = 3 + i;
    const linhas: [number, number][] = [
      [3, e.pedidoSeg],
      [4, e.pedidoTer],
      [5, e.planejado1],
      [6, e.planejado2],
      [7, e.entregue1],
      [8, e.entregue2],
      [11, e.precisa1],
      [12, e.fator1],
      [13, e.disponivel2],
      [14, e.fator2],
      [15, e.faltaDividida],
      [16, e.planejadoNaoLancado],
    ];
    for (const [linha, nosso] of linhas) conf("4 entrega por dia (_ENTREGA)", `${p.nome} linha ${linha}`, nosso, val("_ENTREGA", [linha, col]));
  });

  for (const esc of cadastro.escolas) {
    P.forEach((p, i) => {
      const f = r.fichas[esc.codigo][p.nome];
      const linha = 9 + i;
      conf("5 mapa: enviado à escola", `${esc.codigo}/${p.nome}`, f.enviado, val(esc.aba, [linha, 26]));
      conf("6 escola: aceito / 2ª viagem", `${esc.codigo}/${p.nome} aceito`, f.aceito, val(esc.aba, [linha, 5]));
      conf("6 escola: aceito / 2ª viagem", `${esc.codigo}/${p.nome} 2ª viagem`, f.segundaViagem, val(esc.aba, [linha, 11]));
      conf("7 escola: cobrado e falta", `${esc.codigo}/${p.nome} cobrado`, f.cobrado, val(esc.aba, [linha, 21]));
      conf("7 escola: cobrado e falta", `${esc.codigo}/${p.nome} falta`, f.falta, val(esc.aba, [linha, 6]));
    });
  }

  P.forEach((p, i) => {
    const x = r.resumo.produtos[i];
    conf("10 RESUMO por produto", `${p.nome} cobrado kg`, x.cobradoKg, val("RESUMO", [29 + i, 3]));
    conf("10 RESUMO por produto", `${p.nome} valor cobrado`, x.valorCobrado, val("RESUMO", [29 + i, 5]));
    conf("10 RESUMO por produto", `${p.nome} pago kg`, x.pagoKg, val("RESUMO", [52 + i, 4]));
    conf("10 RESUMO por produto", `${p.nome} valor pago`, x.valorPago, val("RESUMO", [52 + i, 6]));
  });
  conf("11 totais", "A cobrar (E3)", r.resumo.cobrar, val("RESUMO", "E3"));
  conf("11 totais", "A pagar (E4)", r.resumo.pagar, val("RESUMO", "E4"));
  conf("11 totais", "Margem (E5)", r.resumo.margem, val("RESUMO", "E5"));
  conf("11 totais", "Taxa de logística (E21)", r.resumo.taxaLogistica, val("RESUMO", "E21"));
  conf("11 totais", "Perdas (E22)", r.resumo.perdas ?? NaN, val("RESUMO", "E22"));
  conf("11 totais", "Perdas depois do galpão (E23)", r.resumo.perdasDepoisGalpao ?? NaN, val("RESUMO", "E23"));
  conf("11 totais", "Extras pagos (E11)", r.resumo.extrasPagos, val("RESUMO", "E11"));
  conf("11 totais", "Custos (BALANÇO D19)", r.balanco.custos, val("BALANÇO FINANCEIRO", "D19"));
  conf("11 totais", "Saldo (BALANÇO D21)", r.balanco.saldo, val("BALANÇO FINANCEIRO", "D21"));

  let falhas = 0;
  for (const [g, { total, erros }] of Object.entries(grupos).sort()) {
    falhas += erros.length;
    console.log(`${erros.length ? "DIFERENTE" : "ok       "} ${g}: ${total - erros.length}/${total} iguais`);
    erros.slice(0, 6).forEach((e) => console.log("    ", e));
  }
  console.log(falhas ? `\n${falhas} diferença(s).` : "\nTudo igual à planilha.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
