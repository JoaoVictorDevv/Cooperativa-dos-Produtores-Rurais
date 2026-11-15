# App da Cooperativa — como instalar e usar

## Instalar (uma vez só)

1. Instale o **Node.js**: nodejs.org → botão **LTS** → avançar até o fim. Reinicie o PC.
2. Baixe o app: GitHub → branch `claude/pnae-excel-structure-djoy3c` → **Code → Download ZIP**.
   Descompacte em `C:\Cooperativa\app` (tem que existir `C:\Cooperativa\app\package.json`).
3. Coloque os dados: descompacte o `dados-cooperativa.zip` (mandado no chat) **dentro** dessa pasta.
   Tem que ficar `C:\Cooperativa\app\dados-cooperativa\cadastro.json`.
   - Não tem o zip? Sem problema: abra o app, vá em **Cadastro** → "Trazer MODELO" e
     depois "Trazer semana" para cada planilha `controle_...xlsx`.
4. Dois cliques em **`abrir-app.bat`**. Na primeira vez demora uns 5–10 minutos (instala e prepara).
   O navegador abre em **http://localhost:3000/coop**.

## Todo dia

- Dois cliques em **`abrir-app.bat`**. Deixe a janela preta aberta. Para fechar, feche a janela.
- Baixou uma versão nova do app? Dois cliques em **`atualizar-app.bat`** antes.
- Os seus dados ficam na pasta `dados-cooperativa`. Não apague.

## A semana, passo a passo

1. **Previsão** (menu): botão do WhatsApp por produtor → cole as respostas → **Gravar** → imprima para a nutrição.
2. **+ Nova semana**: escolha o arquivo do pedido da Prefeitura → **Ler pedido** → clique nos números que a
   nutricionista cortou → **Criar semana**.
3. **1. Pedido e mensagens**: confira a divisão (**Mexer** para ajustar, inclusive o "1º dia") →
   **Abrir no WhatsApp** em cada produtor → enviar.
4. **2. Galpão domingo** e **3. Galpão segunda**: por produtor, balança + caixas (ou só o líquido), hora,
   quem conferiu, qualidade → **Salvar**. Em branco = veio o pedido. **Não veio** / **Veio tudo certo** = um clique.
5. **4. Mapa e romaneios**: botão **Tudo de segunda** → Imprimir (mapa + excedente + reentregas + romaneios).
   Terça é igual.
6. **5. Retornos**: procure a escola pelo código, marque o que faltou ou foi recusado, ou escreva
   `1005 não veio cheiro verde`. Escola fechada → **marcar reentrega**. No fim: **Terminei: romaneios conferidos**.
7. **6. Fechamento**: custos (já vêm da semana anterior), **Ler conferência** da Prefeitura quando chegar o e-mail,
   descontos, uma linha sobre a semana → **Salvar** → imprimir o resumo do Paulo e os extratos.
8. **Resumo** (menu): todas as semanas lado a lado, para o Paulo. **Relatórios**: mês a mês e vendido por produtor.
9. **Cadastro**: trazer MODELO novo, nome, equipe do galpão, escolas que não recebem e **Baixar backup**.

## Toda semana

- **Cadastro → Baixar backup de hoje** e guarde o zip no pendrive ou no Drive.
- Olhe os **Lembretes** na tela inicial: eles avisam o que está atrasado.

## Deu problema?

- "node não é reconhecido": o Node não instalou ou o PC não foi reiniciado.
- A página não abre: espere mais um pouco e aperte F5. A janela preta tem que estar aberta.
- Apareceu erro na tela: clique em "Tentar de novo". Se continuar, tire foto da mensagem e mande.
