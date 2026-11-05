"""Mensagens de WhatsApp para os produtores, a partir da planilha da semana.

O texto do pedido é o que a própria planilha monta (aba de cada produtor,
célula A28): já usa a divisão, os ajustes do Paulo e os dias da semana. Aqui
só se acrescenta o botão do WhatsApp.

Desde 04/11/2026 a pergunta da previsão vai SEPARADA, depois da entrega (para
não confundir com o pedido). Com --proxima, o arquivo também traz essa
pergunta para todos os produtores, numa seção à parte.

Uso (depois de mexer na divisão, é só rodar de novo):
    python mensagens_produtores.py controle_2026-11-08_Proc_6040-2026.xlsx
    python mensagens_produtores.py controle_2026-11-08_Proc_6040-2026.xlsx --proxima 15/11
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path
from urllib.parse import quote

from comum import recalcular_copia

SEM_PEDIDO = "sem pedido nesta semana"
CABECALHO_DIA = re.compile(r"\*Entregar n[oa] ([^:*]+):\*")


def artigo(dia: str) -> str:
    return "no" if dia.strip().upper() in ("DOMINGO", "SÁBADO", "SABADO") else "na"


def trocar_dias(mensagem: str, dias_semana: list[str] | None) -> str:
    """Semana com feriado: troca os dias do MODELO (DOMINGO = 1º dia,
    SEGUNDA = 2º dia) pelos dias reais (ex.: SEGUNDA, TERÇA). A planilha tem
    esses nomes fixos na fórmula de cada produtor."""
    if not dias_semana:
        return mensagem
    posicao = {"DOMINGO": 0, "SEGUNDA": 1}
    achados = {m.group(1).strip().upper() for m in CABECALHO_DIA.finditer(mensagem)}
    if not achados <= set(posicao):
        return mensagem  # a planilha já foi ajustada à mão; não mexe

    def novo(m):
        i = posicao[m.group(1).strip().upper()]
        dia = dias_semana[min(i, len(dias_semana) - 1)].strip().upper()
        return f"*Entregar {artigo(dia)} {dia}:*"

    return CABECALHO_DIA.sub(novo, mensagem)


def telefone_whatsapp(telefone: str | None) -> str | None:
    digitos = re.sub(r"\D", "", telefone or "")
    if len(digitos) in (10, 11):  # DDD + número
        return "55" + digitos
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        return digitos
    return None


def ler_produtores(wb) -> list[dict]:
    indice = wb["ÍNDICE"]
    telefones = {}
    for r in range(1, indice.max_row + 1):
        nome, tel = indice.cell(r, 1).value, indice.cell(r, 2).value
        if isinstance(nome, str) and isinstance(tel, str) and re.search(r"\d{4}", tel):
            telefones[nome.strip()] = tel.strip()
    produtores = []
    for ws in wb.worksheets:
        if not ws.title.startswith("PROD - "):
            continue
        nome = str(ws["B2"].value or ws.title[7:]).strip()
        mensagem = str(ws["A28"].value or "").strip()
        produtores.append(
            {
                "nome": nome,
                "curto": nome.split()[0],
                "telefone": telefones.get(nome),
                "mensagem": mensagem,
                "tem_pedido": bool(mensagem) and SEM_PEDIDO not in mensagem.lower(),
            }
        )
    return produtores


def montar(produtores, proxima: str | None, dias: str, prazo: str, pular: list[str], dias_semana: list[str] | None = None):
    """Uma lista de cartões: o pedido de quem tem pedido e, se pedir (--proxima),
    a pergunta da previsão para todos (mensagem separada, depois da entrega)."""
    pular_chaves = [p.strip().lower() for p in pular if p.strip()]
    cartoes = []
    for p in produtores:
        p["mensagem"] = trocar_dias(p["mensagem"], dias_semana)
        numero = telefone_whatsapp(p["telefone"])
        link = lambda t: f"https://wa.me/{numero}?text={quote(t)}" if numero else None  # noqa: E731
        if any(k in p["nome"].lower() for k in pular_chaves):
            cartoes.append({**p, "texto": None, "link": None, "grupo": "pulado"})
            continue
        if p["tem_pedido"]:
            cartoes.append({**p, "texto": p["mensagem"], "link": link(p["mensagem"]), "grupo": "pedido"})
        if proxima:
            t = (
                f"Bom dia, {p['curto']}! O que você vai ter pra entrega de {proxima} ({dias})? "
                f"Me fala o produto e quantos kg. Precisamos passar essa previsão pra nutrição até {prazo}. Obrigado!"
            )
            cartoes.append({**p, "texto": t, "link": link(t), "grupo": "previsao"})
    return cartoes


def gravar(produtores, semana: str, destino_html: Path, destino_txt: Path):
    grupos = [
        ("pedido", "Pedido da semana (mandar agora)"),
        ("previsao", "Pergunta da previsão (mandar SEPARADO, depois da entrega)"),
        ("pulado", "Pulados (sem produção)"),
    ]
    cartoes = []
    linhas_txt = [f"MENSAGENS AOS PRODUTORES — semana {semana}", ""]
    for chave, titulo in grupos:
        lista = [p for p in produtores if p["grupo"] == chave]
        if not lista:
            continue
        cartoes.append(f"<h2>{html.escape(titulo)} <span>({len(lista)})</span></h2>")
        linhas_txt += [f"===== {titulo} ({len(lista)}) =====", ""]
        for i, p in enumerate(lista):
            tel = html.escape(p["telefone"] or "sem telefone na planilha")
            if p["texto"] is None:
                cartoes.append(f'<div class="card pulado"><b>{html.escape(p["nome"])}</b> · {tel}</div>')
                linhas_txt += [f"--- {p['nome']} ({p['telefone'] or 'sem telefone'}) — pulado", ""]
                continue
            botao = (
                f'<a class="zap" href="{html.escape(p["link"])}" target="_blank" rel="noopener">Abrir no WhatsApp</a>'
                if p["link"]
                else '<span class="aviso">Sem telefone válido: copie e mande à mão</span>'
            )
            ident = f"{chave}{i}"
            cartoes.append(
                f'<div class="card"><div class="topo"><b>{html.escape(p["nome"])}</b><span>{tel}</span></div>'
                f'<pre id="{ident}">{html.escape(p["texto"])}</pre>'
                f'<div class="acoes">{botao}<button onclick="copiar(\'{ident}\', this)">Copiar texto</button></div></div>'
            )
            linhas_txt += [f"--- {p['nome']} ({p['telefone'] or 'sem telefone'})", p["texto"], ""]

    pagina = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mensagens {html.escape(semana)}</title>
<style>
body{{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f3f5f1;color:#1d2b20;margin:0;padding:16px;}}
main{{max-width:760px;margin:0 auto}} h1{{font-size:20px;margin:4px 0 2px}} p.sub{{margin:0 0 14px;color:#56635a}}
h2{{font-size:15px;margin:22px 0 8px}} h2 span{{color:#56635a;font-weight:400}}
.card{{background:#fff;border:1px solid #dde3da;border-radius:10px;padding:12px;margin-bottom:10px}}
.card.pulado{{color:#56635a}} .topo{{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}} .topo span{{color:#56635a}}
pre{{white-space:pre-wrap;font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;background:#f7f9f5;border-radius:8px;padding:10px;margin:8px 0}}
.acoes{{display:flex;gap:8px;flex-wrap:wrap}} .zap{{background:#1f8a4c;color:#fff;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:600}}
button{{border:1px solid #c4cdc1;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}} .aviso{{color:#9a3b2e}}
</style></head><body><main>
<h1>Mensagens aos produtores — semana {html.escape(semana)}</h1>
<p class="sub">Confira o texto e clique em "Abrir no WhatsApp". O texto do pedido vem da própria planilha (aba de cada produtor).</p>
{''.join(cartoes)}
</main><script>
function copiar(id, b){{const t=document.getElementById(id).innerText;
navigator.clipboard.writeText(t).then(()=>{{b.textContent='Copiado!';setTimeout(()=>b.textContent='Copiar texto',1500)}},
()=>{{const r=document.createRange();r.selectNodeContents(document.getElementById(id));const s=getSelection();s.removeAllRanges();s.addRange(r);}});}}
</script></body></html>"""
    destino_html.write_text(pagina, encoding="utf-8")
    destino_txt.write_text("\n".join(linhas_txt), encoding="utf-8")


def gerar(
    arquivo_semana: Path,
    proxima: str | None = None,
    dias: str = "domingo e segunda",
    prazo: str = "terça",
    pular: list[str] | None = None,
    dias_semana: list[str] | None = None,
):
    wb = recalcular_copia(arquivo_semana)
    semana = str(wb["ÍNDICE"]["D2"].value or "").strip() or arquivo_semana.stem
    produtores = montar(ler_produtores(wb), proxima, dias, prazo, pular or [], dias_semana)
    base = arquivo_semana.with_name(f"mensagens_{arquivo_semana.stem.replace('controle_', '')}")
    gravar(produtores, semana, base.with_suffix(".html"), base.with_suffix(".txt"))
    return produtores, base.with_suffix(".html"), base.with_suffix(".txt")


def main():
    ap = argparse.ArgumentParser(description="Gera as mensagens de WhatsApp dos produtores a partir da planilha da semana.")
    ap.add_argument("semana", type=Path, help="arquivo controle_AAAA-MM-DD_....xlsx")
    ap.add_argument("--proxima", help="data da entrega seguinte, ex.: 15/11 (acrescenta a pergunta da previsão, separada)")
    ap.add_argument("--dias", default="domingo e segunda", help='dias da entrega seguinte (padrão: "domingo e segunda")')
    ap.add_argument("--prazo", default="terça", help="até quando a previsão vai para a nutrição (padrão: terça)")
    ap.add_argument("--pular", default="", help='produtores sem produção, separados por vírgula (ex.: "Claudeni")')
    ap.add_argument("--dias-semana", default="", help='semana com feriado: dias do galpão, ex.: "SEGUNDA,TERÇA"')
    a = ap.parse_args()
    if not a.semana.exists():
        sys.exit(f"Arquivo não encontrado: {a.semana}")
    dias_semana = [d for d in a.dias_semana.split(",") if d.strip()] or None
    produtores, h, t = gerar(a.semana, a.proxima, a.dias, a.prazo, a.pular.split(","), dias_semana)
    resumir(produtores, h, t)


def resumir(produtores, h: Path, t: Path):
    com = [p["curto"] for p in produtores if p["grupo"] == "pedido"]
    prev = [p["curto"] for p in produtores if p["grupo"] == "previsao"]
    sem_tel = [p["nome"] for p in produtores if p["texto"] and not p["link"]]
    print(f"Com pedido ({len(com)}): {', '.join(com) or '—'}")
    print(f"Pergunta da previsão, separada ({len(prev)}): {', '.join(prev) or '—'}")
    if sem_tel:
        print(f"Sem telefone válido: {', '.join(sem_tel)}")
    print(f"Abra no navegador: {h}")
    print(f"Texto puro: {t}")


if __name__ == "__main__":
    main()
