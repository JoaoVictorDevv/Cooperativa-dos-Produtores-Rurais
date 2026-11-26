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
   Já tem tudo num documento? Em **Anexe ou cole aqui**, escolha o arquivo (conversa exportada do WhatsApp `.txt`,
   `.xlsx`, `.docx`) ou cole o texto → **Preencher a previsão com isso** → confira → **Gravar**.
2. **+ Nova semana**: escolha o arquivo do pedido da Prefeitura → **Ler pedido** → clique nos números que a
   nutricionista cortou → **Criar semana**.
3. **1. Pedido e mensagens**: confira a divisão (**Mexer** para ajustar, inclusive o "1º dia") →
   **Abrir no WhatsApp** em cada produtor → enviar (o ✓ marca sozinho). Mandou por fora? Marque o ✓ ou **Já mandei para todos**.
4. **2. Galpão domingo** e **3. Galpão segunda**: por produtor, balança + caixas (ou só o líquido), hora,
   quem conferiu, qualidade → **Salvar**. Em branco = veio o pedido. Produto ruim? Ponha os kg em **Recusado**:
   sai sozinho do pagamento do produtor e aparece no demonstrativo. **Veio tudo certo** / **Não veio** = um clique.
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

## Celular

1. Abra o app no PC (atalho). A janela preta mostra o endereço para o celular, ex.: `http://192.168.0.10:3000/coop`.
2. No celular, **no mesmo Wi-Fi do PC**, abra esse endereço e digite o **PIN** (começa 1234; troque em Cadastro → Celular).
   Ele lembra por 1 ano. Use "Adicionar à tela inicial" para ter o ícone da cooperativa.
3. Na primeira vez o Windows pergunta sobre o acesso: clique em **Permitir**.
   **O celular não abre?** Dois cliques em **`liberar-celular.bat`** (na pasta do app) → **Sim** → feche e abra o app de novo.
4. Longe de casa (ex.: no galpão com o notebook)? Ligue o roteador do celular e conecte o notebook nele.

No próprio PC o atalho entra direto, sem PIN.

## Modo galpão (celular)

No celular, toque em **Galpão** no menu: abre sozinho o dia certo da semana certa (domingo ou segunda).
1. Toque no seu nome em "Quem está conferindo" (fica lembrado no celular).
2. Toque no produtor. Veio igual ao pedido? **✓ Veio tudo certo**.
3. Senão, em cada produto: peso da **balança**, e **+ / −** nas caixas grandes e pequenas. O líquido vai
   diminuindo na hora. Mais de uma pesagem? **+ Somar outra pesagem**. Produto ruim? **Recusar uma parte**.
4. **Salvar** (ou **Não veio**). Já entra na semana, no mapa e no pagamento.

Entrega extra e ajustes finos continuam na tela completa do galpão (no computador).

## Escala do galpão

Em **Cadastro → Escala do galpão**: quem trabalha em cada dia, a hora e a diária (a diária só aparece no app).
A semana nova já vem com o custo de montagem pela escala (ex.: 7 diárias × R$ 150 = R$ 1.050); no Fechamento dá para mudar.
**Folha da equipe** para imprimir ou salvar imagem. Na aba Galpão aparece quem está escalado no dia.

## Pagamento dos produtores

No fim do **Fechamento** tem um ✓ só: "Produtores desta semana já foram pagos". Marque quando a semana for paga.

## Limite de R$ 40 mil

**Relatórios → Folha do limite**: quanto cada produtor já vendeu no ano (valor de venda que a Prefeitura paga,
mais o pedido de semana ainda sem entrega) e quanto ainda pode vender. Só informação: o app não trava nada.

## Imagens para o WhatsApp

Nas folhas de **Resumo**, **Perdas** (escolha **Por motivo** ou **Por produto**), **Previsão**, **Equipe do galpão**, **resumo do Paulo** e **demonstrativos** tem o botão **🖼 Salvar imagem**:
baixa a folha como foto (PNG, na pasta Downloads), pronta para mandar no WhatsApp.

## Toda semana

- **Cadastro → Baixar backup de hoje** e guarde o zip no pendrive ou no Drive.
- Olhe os **Lembretes** na tela inicial: eles avisam o que está atrasado.

## Deu problema?

- **"Falta instalar o Node.js"**: instale pelo nodejs.org e reinicie o PC.
- **A janela fecha sozinha**: abra a pasta do app, clique na barra de endereço, digite `cmd` e Enter,
  depois digite `abrir-app.bat` e Enter. A janela fica aberta e mostra o erro. Tire uma foto e mande.
- **A página não abre**: espere a janela mostrar "Pronto!" e aperte F5. A janela preta tem que estar aberta.
- **Erro numa tela do app**: clique em "Tentar de novo". Se continuar, tire foto e mande.
