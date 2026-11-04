"""Lê a "Planilha de Pedido" que a Prefeitura manda toda semana.

Formato (conferido nos pedidos de 05/10, 20/10 e 26/10/2026):
- abas "Modalidade - UE", "Modalidade - UE Integral", "Modalidade - EMEI" e
  "Modalidade - CEI": linha 1 diz "Pedido"/"Entrega", linha 2 o produto;
  as escolas começam na linha 6 (coluna A = código) até "Subtotal Escolas =";
- aba "TOTAL": linha 4 o produto; linhas 5 a 8 os subtotais por modalidade e
  a linha "TOTAL=" (coluna B) o total geral.
Só as colunas "Pedido" interessam.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

from comum import APELIDOS_PRODUTO, codigo_escola, sem_acento

ABAS_MODALIDADE = ["Modalidade - UE", "Modalidade - UE Integral", "Modalidade - EMEI", "Modalidade - CEI"]


@dataclass
class PedidoPrefeitura:
    # código da escola → {produto (nome da nossa planilha) → kg}
    por_escola: dict[str, dict[str, float]] = field(default_factory=dict)
    # produto (nome da nossa planilha) → total da aba TOTAL da Prefeitura
    total_prefeitura: dict[str, float] = field(default_factory=dict)
    # produtos pedidos que a cooperativa não tem na planilha
    fora_da_lista: dict[str, float] = field(default_factory=dict)
    # linhas com pedido mas sem código de escola reconhecível (ex.: "GAE")
    sem_codigo: list[str] = field(default_factory=list)


def nome_nosso(nome_prefeitura: str, nossos: list[str]) -> str | None:
    chave = sem_acento(nome_prefeitura)
    if chave in APELIDOS_PRODUTO:
        return APELIDOS_PRODUTO[chave]
    por_chave = {sem_acento(n): n for n in nossos}
    return por_chave.get(chave)


def ler_pedido(arquivo: Path, nossos_produtos: list[str]) -> PedidoPrefeitura:
    wb = openpyxl.load_workbook(arquivo, data_only=True)
    faltando = [a for a in ABAS_MODALIDADE if a not in wb.sheetnames]
    if faltando:
        raise SystemExit(f"Este arquivo não parece o pedido da Prefeitura: faltam as abas {faltando}.")

    pedido = PedidoPrefeitura()
    for aba in ABAS_MODALIDADE:
        ws = wb[aba]
        colunas = [
            (c, str(ws.cell(2, c).value).strip())
            for c in range(4, ws.max_column + 1)
            if ws.cell(1, c).value == "Pedido" and ws.cell(2, c).value
        ]
        for r in range(6, ws.max_row + 1):
            bruto = ws.cell(r, 1).value
            if isinstance(bruto, str) and bruto.strip().lower().startswith("subtotal"):
                break
            quantidades = {}
            for c, nome in colunas:
                v = ws.cell(r, c).value
                if isinstance(v, (int, float)) and v > 0:
                    quantidades[nome] = quantidades.get(nome, 0) + float(v)
            if not quantidades:
                continue
            codigo = codigo_escola(bruto)
            if codigo is None:
                pedido.sem_codigo.append(f"{aba}, linha {r}: {bruto!r}")
                continue
            destino = pedido.por_escola.setdefault(codigo, {})
            for nome, kg in quantidades.items():
                nosso = nome_nosso(nome, nossos_produtos)
                if nosso is None:
                    pedido.fora_da_lista[nome] = pedido.fora_da_lista.get(nome, 0) + kg
                    continue
                destino[nosso] = destino.get(nosso, 0) + kg

    if "TOTAL" in wb.sheetnames:
        ws = wb["TOTAL"]
        linha_total = next(
            (r for r in range(1, ws.max_row + 1) if str(ws.cell(r, 2).value or "").strip().upper() == "TOTAL="),
            None,
        )
        for c in range(3, ws.max_column + 1 if linha_total else 3):
            if ws.cell(3, c).value == "Pedido" and ws.cell(4, c).value:
                v = ws.cell(linha_total, c).value
                if isinstance(v, (int, float)) and v > 0:
                    nosso = nome_nosso(str(ws.cell(4, c).value), nossos_produtos)
                    if nosso:
                        pedido.total_prefeitura[nosso] = pedido.total_prefeitura.get(nosso, 0) + float(v)
    return pedido
