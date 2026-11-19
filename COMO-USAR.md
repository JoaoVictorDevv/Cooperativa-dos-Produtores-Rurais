# App da Cooperativa — como instalar e usar

## Instalar (uma vez só)

1. **Node.js**: entre em nodejs.org, baixe a versão **LTS** e instale (só "Next" até o fim). Reinicie o PC.
2. **Baixar o app** (escolha um):
   - **GitHub Desktop** (o que você já usa): File → Clone repository → `Cooperativa-dos-Produtores-Rurais`
     → escolha a pasta `C:\Cooperativa` → Clone.
   - **Sem GitHub Desktop**: na página do projeto no GitHub, botão verde **Code → Download ZIP** →
     descompacte em `C:\Cooperativa\app`.
3. **Seus dados**: descompacte o `dados-cooperativa.zip` **dentro** da pasta do app
   (tem que ficar `...\dados-cooperativa\cadastro.json`).
   Não tem o zip? Sem problema: abra o app e, em **Cadastro**, traga o MODELO e as planilhas das semanas.
4. Dois cliques em **`abrir-app.bat`**.
   - Na primeira vez ele instala (uns 5 minutos; os avisos amarelos `npm warn` são normais)
     e prepara o app (uns 2 minutos).
   - Ele cria um atalho **App Cooperativa** (com a logo) na Área de Trabalho.
   - Quando estiver pronto, o navegador abre sozinho em **http://localhost:3000/coop**.

## Todo dia

- Dois cliques no atalho **App Cooperativa** (ou no `abrir-app.bat`).
- **Deixe a janela preta aberta** enquanto usa. Para fechar o app, feche a janela.
- Se já estava aberto, ele só abre o navegador de novo.

## Atualizar (quando sair versão nova)

1. Feche o app (feche a janela preta).
2. **GitHub Desktop**: clique em **Fetch origin** e depois em **Pull origin**.
   (Sem GitHub Desktop: dois cliques em `atualizar-app.bat`, ele baixa sozinho.)
3. Abra o app normalmente. Na primeira vez depois de atualizar ele leva uns 2 minutos para preparar.

Seus dados ficam na pasta `dados-cooperativa` e **não mudam** ao atualizar.

## A semana, passo a passo

1. **Previsão** (menu): botão do WhatsApp por produtor → cole as respostas → **Gravar** → imprima para a nutrição.
2. **+ Nova semana**: escolha o arquivo do pedido da Prefeitura → **Ler pedido** → clique nos números que a
   nutricionista cortou → **Criar semana**.
3. **1. Pedido e mensagens**: confira a divisão (**Mexer** para ajustar, inclusive o "1º dia") →
   **Abrir no WhatsApp** em cada produtor → enviar.
4. **2. Galpão domingo** e **3. Galpão segunda**: por produtor, balança + caixas (ou só o líquido), hora,
   quem conferiu, qualidade → **Salvar**. Em branco = veio o pedido. **Veio tudo certo** / **Não veio** = um clique.
5. **4. Mapa e romaneios**: botão **Tudo de segunda** → Imprimir (mapa + excedente + reentregas + romaneios).
   Terça é igual.
6. **5. Retornos**: procure a escola pelo código, marque o que faltou ou foi recusado, ou escreva
   `1005 não veio cheiro verde`. Escola fechada → **marcar reentrega**. No fim: **Terminei: romaneios conferidos**.
7. **6. Fechamento**: custos (já vêm da semana anterior), **Ler conferência** da Prefeitura quando chegar o e-mail,
   descontos, uma linha sobre a semana → **Salvar** → imprima o resumo do Paulo e os demonstrativos.
   Em cada produtor tem **WhatsApp**: abre a conversa com o demonstrativo pronto, é só enviar.
8. **Resumo** (menu): todas as semanas lado a lado, para o Paulo. **Relatórios**: mês a mês e vendido por produtor.
9. **Cadastro**: trazer MODELO novo, nome, equipe do galpão, escolas que não recebem e **Baixar backup**.

## Atalhos

- **Procurar** (caixa no alto, ou aperte `/`): digite o código da escola, o nome do produtor ou a data da semana.
  Escola abre direto nos Retornos; produtor abre a **ficha** dele (semanas, vendido no ano, descontos).
- **✓ nas abas** = etapa terminada. No fim de cada etapa tem o botão **Próxima**.
- Se você digitar e tentar sair sem salvar, o app pergunta antes.
- **Adicionais** (no fim das telas, clique no ＋): previsão × entregue (resumo da semana),
  gráfico semana a semana (Resumo) e perdas por produto (Relatórios).

## Toda semana

- **Cadastro → Baixar backup de hoje** e guarde o zip no pendrive ou no Drive.
- Olhe os **Lembretes** na tela inicial: eles avisam o que está atrasado.

## Deu problema?

- **"Falta instalar o Node.js"**: instale pelo nodejs.org e reinicie o PC.
- **A janela fecha sozinha**: abra a pasta do app, clique na barra de endereço, digite `cmd` e Enter,
  depois digite `abrir-app.bat` e Enter. A janela fica aberta e mostra o erro. Tire uma foto e mande.
- **A página não abre**: espere a janela mostrar "Pronto!" e aperte F5. A janela preta tem que estar aberta.
- **Erro numa tela do app**: clique em "Tentar de novo". Se continuar, tire foto e mande.
