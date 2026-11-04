"""Partes comuns das ferramentas da planilha da Cooperativa.

Regras da casa (docs da cooperativa):
- edita só com openpyxl, sem mexer em fórmulas; o arquivo final nunca é salvo
  pelo LibreOffice;
- o LibreOffice só recalcula uma CÓPIA, para ler os valores (mensagens,
  totais) — a cópia é apagada no fim.
"""

from __future__ import annotations

import datetime as dt
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from pathlib import Path

import openpyxl

# Os 19 produtos da planilha (Entrada de Dados, linha 5, colunas C..U).
PRIMEIRA_COL_PRODUTO = 3  # C
ULTIMA_COL_PRODUTO = 21  # U
LINHAS_ESCOLAS = range(6, 206)  # Entrada de Dados: pedido das escolas

# Nome na planilha da Prefeitura → nome na nossa planilha (quando muda).
APELIDOS_PRODUTO = {
    "alface": "Alface lisa",
    "couve": "Couve manteiga",
    "cheiro-verde": "Cheiro verde",
    "maca": "Maçã gala",
    "ovo": "Ovos (dz)",
    "ovos": "Ovos (dz)",
    "tangerina": "Tangerina ponkan",
}


def sem_acento(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in texto if not unicodedata.combining(c)).strip().lower()


def codigo_escola(valor) -> str | None:
    """Código da unidade como texto ("1001", "1033.2").

    Cuidado real: no arquivo da Prefeitura o Excel transformou "2033.2" em
    data (01/02/2033). Data vira de novo "ano.mês".
    """
    if valor is None:
        return None
    if isinstance(valor, dt.datetime):
        return f"{valor.year}.{valor.month}"
    if isinstance(valor, float):
        return str(int(valor)) if valor.is_integer() else repr(valor)
    if isinstance(valor, int):
        return str(valor)
    texto = str(valor).strip()
    return texto if re.fullmatch(r"\d+(\.\d+)?", texto) else None


def soffice() -> str:
    """Caminho do LibreOffice (Linux ou Windows). SOFFICE=... força outro."""
    candidatos = [
        os.environ.get("SOFFICE"),
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for c in candidatos:
        if c and Path(c).exists():
            return c
    raise SystemExit(
        "Não achei o LibreOffice. Instale ou diga onde está: SOFFICE=caminho\\soffice.exe"
    )


def recalcular_copia(arquivo: Path):
    """Abre uma CÓPIA recalculada pelo LibreOffice, só para leitura.

    Devolve o workbook (data_only) já carregado; nada é gravado no arquivo
    original.
    """
    with tempfile.TemporaryDirectory(prefix="coop_") as tmp:
        tmp = Path(tmp)
        entrada = tmp / "entrada" / arquivo.name
        entrada.parent.mkdir()
        shutil.copy2(arquivo, entrada)
        saida = tmp / "saida"
        env = dict(os.environ, LANG="pt_BR.UTF-8", LC_ALL="pt_BR.UTF-8")
        subprocess.run(
            [
                soffice(),
                "--headless",
                f"-env:UserInstallation=file:///{(tmp / 'perfil').as_posix().lstrip('/')}",
                "--calc",
                "--convert-to",
                "xlsx:Calc MS Excel 2007 XML",
                "--outdir",
                str(saida),
                str(entrada),
            ],
            check=True,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=900,
        )
        convertido = saida / arquivo.name
        if not convertido.exists():
            raise SystemExit("O LibreOffice não conseguiu recalcular a cópia da planilha.")
        return openpyxl.load_workbook(convertido, data_only=True)


def kg(valor: float) -> str:
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
