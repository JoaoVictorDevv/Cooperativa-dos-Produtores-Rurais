# Ferramentas da planilha da Cooperativa

Automatizam a planilha semanal (MODELO v100) sem mudar nenhuma fórmula dela.

## Pedido da Prefeitura chegou → semana + mensagens (um comando)

```
python nova_semana.py --pedido "Planilha de Pedido 08-11-2026.xlsx" ^
  --modelo controle_escolas_produtores_2026_MODELO_v100.xlsx ^
  --data 08/11/2026 --entrega 3 --pular Claudeni
```

O que faz:
1. Copia o MODELO. O MODELO não é alterado.
2. Lança o pedido de cada escola na Entrada de Dados (bloco das escolas),
   pelo código da escola. O código "2033.2", que o Excel da Prefeitura
   transforma em data, também é reconhecido.
3. Preenche a semana (ÍNDICE D2) e o nº da entrega (ÍNDICE E4).
4. Confere o total de cada produto com a linha "TOTAL=" da aba TOTAL da
   Prefeitura e avisa:
   - se o pedido tem produto fora da nossa lista;
   - se tem escola que não existe no MODELO (nesse caso, para sem gravar).
5. Grava `controle_AAAA-MM-DD_Proc_6040-2026.xlsx`. Nunca sobrescreve uma
   semana que já existe.
6. Gera as mensagens do pedido aos produtores (`mensagens_....html` e
   `.txt`). Com `--proxima 15/11`, o arquivo também traz a pergunta da
   previsão, numa seção à parte.

## Só as mensagens (depois de mexer na divisão)

Se o Paulo mudar o pedido de algum produtor, digite por cima na planilha,
salve e rode de novo:

```
python mensagens_produtores.py controle_2026-11-08_Proc_6040-2026.xlsx --pular Claudeni
```

- O texto do pedido é o da própria planilha (aba de cada produtor, célula
  A28). Ou seja, vale a divisão com os ajustes do Paulo, e **o que vai na
  mensagem é o que vale para pagar**.
- Quem tem pedido recebe só o pedido (desde 04/11, sem a pergunta da
  próxima, para não confundir).
- A pergunta da previsão vai **separada, depois da entrega**: com
  `--proxima 15/11` ela aparece para todos os produtores, numa seção à parte.
- `--pular` pula quem está sem produção (ex.: Claudeni).
- Semana com feriado: `--dias-semana "SEGUNDA,TERÇA"` troca "DOMINGO /
  SEGUNDA" pelos dias certos na mensagem.
- `--dias` muda os dias da próxima entrega (padrão "domingo e segunda") e
  `--prazo` muda o prazo da nutrição (padrão "terça").
- Abra o `.html` no navegador: cada produtor tem o botão **Abrir no
  WhatsApp**, com o texto já pronto, e o botão **Copiar texto**. Os
  telefones vêm do ÍNDICE (coluna B).

## O que precisa no computador

- Python 3 com `openpyxl` (`pip install openpyxl`).
- LibreOffice, usado **só para recalcular uma cópia** e ler as mensagens. A
  planilha final nunca é salva pelo LibreOffice. Se ele não for encontrado
  sozinho, informe o caminho: `set SOFFICE=C:\Program Files\LibreOffice\program\soffice.exe`.

## Testado com dados reais (04/11/2026)

- **Pedido de 20/10:** as 801 células lançadas ficaram **idênticas** às da
  semana que já estava fechada.
- **Pedido de 26/10:** a ferramenta lança tudo o que a Prefeitura pediu, e
  os totais batem com a aba TOTAL. A semana fechada tem 517,57 kg a menos
  (cenoura e cheiro verde da CEI), porque esses itens ficaram fora quando a
  semana foi lançada à mão.
- A planilha gerada recalcula com zero erros.
- A mensagem do pedido é exatamente o texto da planilha (A28).

Não versionar planilhas com pedido ou semanas: elas ficam fora do repositório.
