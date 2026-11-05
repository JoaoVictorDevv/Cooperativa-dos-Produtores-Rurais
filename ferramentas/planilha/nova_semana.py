"""Pedido da Prefeitura chegou → planilha da semana + mensagens dos produtores.

Faz o que antes era manual:
1. copia o MODELO (o MODELO não é alterado);
2. lança o pedido de cada escola na Entrada de Dados (bloco das escolas);
3. preenche a semana (ÍNDICE D2) e o nº da entrega (ÍNDICE E4);
4. confere os totais por produto com a aba TOTAL da Prefeitura;
5. já gera as mensagens de WhatsApp do pedido; com --proxima, também a
   pergunta da previsão (mensagem separada, para mandar depois da entrega).

Uso:
    python nova_semana.py --pedido "Planilha de Pedido 08-11-2026.xlsx" \\
        --modelo controle_escolas_produtores_2026_MODELO_v100.xlsx \\
        --data 08/11/2026 --entrega 3 --proxima 15/11
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

import openpyxl

from comum import LINHAS_ESCOLAS, PRIMEIRA_COL_PRODUTO, ULTIMA_COL_PRODUTO, kg
from pedido_prefeitura import ler_pedido

TOLERANCIA_KG = 0.01


def escolas_do_modelo(wb) -> dict[str, int]:
    """código da escola → linha da Entrada de Dados (o código vem da ficha, B5)."""
    ent = wb["Entrada de Dados"]
    linhas = {}
    for r in LINHAS_ESCOLAS:
        formula = str(ent.cell(r, 1).value or "")
        m = re.fullmatch(r"='(.+)'!B5", formula)
        if not m:
            raise SystemExit(f"Entrada de Dados A{r} não aponta para uma ficha de escola: {formula!r}")
        codigo = str(wb[m.group(1)]["B5"].value).strip()
        linhas[codigo] = r
    return linhas


def criar_semana(pedido_arq: Path, modelo_arq: Path, data: str, entrega: int, pasta: Path):
    data_ok = dt.datetime.strptime(data, "%d/%m/%Y")
    wb = openpyxl.load_workbook(modelo_arq)
    ent, indice = wb["Entrada de Dados"], wb["ÍNDICE"]

    preenchidas = [
        ent.cell(r, c).coordinate
        for r in LINHAS_ESCOLAS
        for c in range(PRIMEIRA_COL_PRODUTO, ULTIMA_COL_PRODUTO + 1)
        if ent.cell(r, c).value not in (None, "")
    ]
    if preenchidas or indice["D2"].value:
        raise SystemExit("Esse arquivo não está vazio (tem pedido ou data). Use o MODELO, não uma semana.")

    produtos = {
        str(ent.cell(5, c).value).strip(): c for c in range(PRIMEIRA_COL_PRODUTO, ULTIMA_COL_PRODUTO + 1)
    }
    linhas = escolas_do_modelo(wb)
    pedido = ler_pedido(pedido_arq, list(produtos))

    nao_existem = sorted(set(pedido.por_escola) - set(linhas))
    if nao_existem:
        raise SystemExit(
            "O pedido tem escolas que não existem no MODELO (precisa criar a ficha antes): "
            + ", ".join(nao_existem)
        )

    lancado: dict[str, float] = {}
    for codigo, itens in pedido.por_escola.items():
        r = linhas[codigo]
        for produto, quantidade in itens.items():
            ent.cell(r, produtos[produto]).value = round(quantidade, 6)
            lancado[produto] = lancado.get(produto, 0) + quantidade

    indice["D2"].value = data_ok.strftime("%d/%m/%Y")  # texto, como nas semanas fechadas
    indice["E4"].value = entrega
    wb.calculation.fullCalcOnLoad = True

    processo = re.sub(r"[^\d/]", "", str(indice["E6"].value or "")).replace("/", "-") or "sem-processo"
    destino = pasta / f"controle_{data_ok:%Y-%m-%d}_Proc_{processo}.xlsx"
    if destino.exists():
        raise SystemExit(f"Já existe {destino.name}. Não vou sobrescrever uma semana.")
    wb.save(destino)

    conferencia = []
    for produto in sorted(set(lancado) | set(pedido.total_prefeitura)):
        nosso, deles = lancado.get(produto, 0), pedido.total_prefeitura.get(produto, 0)
        conferencia.append((produto, nosso, deles, abs(nosso - deles) <= TOLERANCIA_KG))
    return destino, pedido, conferencia, len(pedido.por_escola)


def main():
    ap = argparse.ArgumentParser(description="Cria a planilha da semana a partir do pedido da Prefeitura.")
    ap.add_argument("--pedido", type=Path, required=True, help="Planilha de Pedido da Prefeitura (.xlsx)")
    ap.add_argument("--modelo", type=Path, required=True, help="controle_escolas_produtores_2026_MODELO_v100.xlsx")
    ap.add_argument("--data", required=True, help="semana / data de referência, ex.: 08/11/2026")
    ap.add_argument("--entrega", type=int, required=True, help="nº da entrega (20/10 foi 1, 26/10 foi 2)")
    ap.add_argument("--pasta", type=Path, default=Path("."), help="onde gravar (padrão: pasta atual)")
    ap.add_argument("--proxima", help="data da entrega seguinte, ex.: 15/11 (acrescenta a pergunta da previsão)")
    ap.add_argument("--dias", default="domingo e segunda")
    ap.add_argument("--prazo", default="terça")
    ap.add_argument("--pular", default="", help='produtores sem produção, ex.: "Claudeni"')
    ap.add_argument("--dias-semana", default="", help='semana com feriado: dias do galpão, ex.: "SEGUNDA,TERÇA"')
    a = ap.parse_args()
    for f in (a.pedido, a.modelo):
        if not f.exists():
            sys.exit(f"Arquivo não encontrado: {f}")

    destino, pedido, conferencia, n_escolas = criar_semana(a.pedido, a.modelo, a.data, a.entrega, a.pasta)
    print(f"Semana criada: {destino}")
    print(f"Escolas com pedido: {n_escolas}")
    print("Conferência com a aba TOTAL da Prefeitura (kg):")
    for produto, nosso, deles, ok in conferencia:
        print(f"  {'ok ' if ok else 'DIFERENTE'} {produto}: lançado {kg(nosso)} · Prefeitura {kg(deles)}")
    if pedido.fora_da_lista:
        print("ATENÇÃO — pedidos de produtos que não estão na nossa planilha (não lançados):")
        for nome, q in pedido.fora_da_lista.items():
            print(f"  {nome}: {kg(q)} kg")
    if pedido.sem_codigo:
        print("ATENÇÃO — linhas com pedido sem código de escola (não lançadas):")
        for linha in pedido.sem_codigo:
            print(f"  {linha}")

    from mensagens_produtores import gerar, resumir

    dias_semana = [d for d in a.dias_semana.split(",") if d.strip()] or None
    produtores, h, t = gerar(destino, a.proxima, a.dias, a.prazo, a.pular.split(","), dias_semana)
    resumir(produtores, h, t)


if __name__ == "__main__":
    main()
