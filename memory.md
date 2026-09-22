# Colheita — memória do progresso

## Estado do app real (Next.js/Prisma, branch `claude/pnae-excel-structure-djoy3c`)
Sistema completo seguindo a especificação formal (CA-*): auth multiusuário,
semanas (criar/fechar/reabrir com auditoria), pedido das escolas,
produtores (divisão/pedido/entrega/devolução em tabelas separadas), preços
com histórico, resumo, balanço, conferência, PNAE, histórico e mapa de
produção. Testado de ponta a ponta, build de produção limpo, 23 testes
automatizados passando. Commitado e enviado ao GitHub (commit `511e4d3`).
Deploy (Vercel + Neon) ainda não foi feito.

## Modelo de demonstração (Artifact, não é o app real)
Link: https://claude.ai/artifact/DDRFektseWv8ZSDkTSyyqp
Protótipo em HTML/JS puro (sem backend) pra apresentar pro chefe. Usado
como rascunho rápido pra validar decisões ANTES de mexer no app de
verdade — é assim que estamos trabalhando: ajusta no modelo → chefe
aprova → só então implementa no código real.

### Mudanças já feitas e validadas no modelo (AINDA NÃO estão no app real)
1. **Unidade em kg** — mostra "120 kg" em vez de "120.00" (só usa decimal
   quando existe de verdade). Precisa portar pro `fmtQty`-equivalente no
   app real (hoje os componentes usam `.toFixed(2)` cru em vários lugares).
2. **Devolução como ação deliberada** — em vez de campo sempre vazio
   visível, agora é um link "+ Registrar devolução" que só vira input
   quando clicado (ou se já existe devolução lançada). Resolve a
   reclamação do chefe de que o campo "instigava" lançar devolução à toa.
   Precisa portar essa mesma lógica pros componentes reais
   (`ReturnRow.tsx` da ficha de escola e `ProducerProductRow.tsx`).
3. **Total no romaneio do produtor** — linha de total (pedido, entrega,
   devolução, valor) no fim da ficha impressa. Portar pra
   `produtores/[internalId]/page.tsx`.
4. **Limite Anual PNAE removido da interface** — tirado do dashboard e da
   ficha do produtor porque isso já é resolvido direto com a prefeitura
   (produtores preenchem e entregam esse controle separadamente). **Ação
   no app real**: remover os painéis de alerta PNAE de
   `src/app/(app)/page.tsx` e `produtores/[internalId]/page.tsx`. Dúvida
   em aberto: manter ou apagar `src/lib/pnae.ts` e o campo relacionado no
   schema/testes (os 4 testes de integração de PNAE também dependem
   disso) — perguntar antes de apagar teste/lib, só remover a UI por ora.
5. **Balanço Financeiro: rótulo "Vendas Merenda Escolar (PMP)"** — troquei
   "Vendas à Prefeitura" (e as ocorrências equivalentes em Dashboard e
   Resumo: "A cobrar da prefeitura") por esse rótulo mais específico. O
   motivo dado: podem entrar outros clientes no futuro (outra prefeitura,
   um hortifruti) — o nome não pode ficar hardcoded pra "a prefeitura"
   genérica. **Implicação estrutural pro app real** (ainda não
   implementada, só a UI do modelo foi ajustada): isso sugere que
   `SchoolOrder`/`School` deveriam eventualmente pertencer a um `Cliente`
   (PMP sendo o primeiro), pra permitir somar vendas por cliente e um
   total geral. Não fizemos esse modelo de dados ainda — só troquei o
   texto no protótipo. Avaliar com o usuário se isso entra já ou depois.
6. **Histórico com "abrir e ver direitinho"** — linhas da tabela agora são
   clicáveis e abrem uma tela de detalhe da semana (vendas, pago, margem,
   saldo, os 8 custos). No app real isso praticamente já existe
   (`/semanas/[weekId]`, e `/resumo?week=` / `/balanco?week=`) — só
   confirmar que a navegação a partir de `/historico` está linkando pra
   essas rotas corretamente (parece que sim, foi implementado antes).
7. **Mapa de Produção com os 12 meses** — o modelo antes só mostrava
   Outubro; corrigido pra mostrar Out–Set completo + total ano, igual à
   planilha real. **O app real (`/mapa-producao`) já faz isso certo**
   (usa os 12 meses do `ProductionMapEntry`) — esse era só um atalho que
   eu tinha tomado no protótipo, não um problema no app de verdade.
8. **Importar pedido da Prefeitura (Excel)** — adicionei upload de .xlsx
   na tela de Pedido das Escolas, usando SheetJS (carregado via cdnjs) no
   navegador: lê a aba, acha o cabeçalho CÓDIGO/ESCOLA, casa as colunas
   de produto pelo nome, e preenche o pedido de cada escola reconhecida.
   **Testado e validado de verdade**: rodei o mesmo algoritmo em Node
   contra a estrutura real da aba "Entrada de Dados" da planilha
   (`v27` e agora relevante pra `v35` também) e bateu exato (19 colunas
   de produto reconhecidas, código casado corretamente). PDF **não foi
   implementado** — não dá pra extrair tabela de PDF de forma confiável
   sem a prefeitura padronizar um layout fixo primeiro; isso ficou só
   como aviso no texto da tela, não como funcionalidade. Precisa virar
   Server Action real no app (`saveSchoolOrder` em lote) + componente de
   upload em `escolas/page.tsx`.

## Planilha atualizada pra v35 — o que mudou de verdade (verificado direto no arquivo, célula por célula, não só no resumo que o usuário mandou)

Arquivo: `9d130ecd-controle_escolas_produtores_2026_v35.xlsx` (224 abas,
era 225 na v27).

1. **Aba "LIMITE ANUAL PNAE" foi removida da planilha.** Confirmado (não
   existe mais entre as 224 abas). Isso não muda a spec do app: o teto de
   R$40.000/produtor/ano **continua** precisando ser calculado
   automaticamente a partir do histórico semanal, como já estava (e como
   o app real já faz via `src/lib/pnae.ts`). Só não sobrou mais essa aba
   de referência manual na planilha em si.

2. **Nova aba "MAPA DE MONTAGEM" — feature grande, real, verificada linha
   por linha.** É a ferramenta de logística do galpão. Confirmei:
   - **18 rotas fixas**: Segunda S1–S10 (100 escolas / 95 paradas
     físicas), Terça T1–T8 (91 escolas / 85 paradas físicas). Bati a
     soma exata: 100+91=191 escolas, 95+85=180 paradas físicas.
   - **11 pares de escolas compartilham parada** (mesmo endereço),
     marcados como SUB "A"/"B" na mesma linha de PAR (nº de parada) —
     confirmei 11 ocorrências de SUB="A" na planilha. Cada uma continua
     sendo **entidade separada** pra pedido/devolução/romaneio — só a
     parada física é compartilhada.
   - Cada rota tem: nome + corredor/região, veículo-base sugerido
     (Caminhão médio / Kombi / Caminhão leve / Kombi + último trecho por
     moto), uma observação livre de atenção da rota (ex: "trechos
     sinuosos", "confirmar manobra"), e a sequência de escolas em ordem
     fixa de entrega (colunas PAR., SUB, CÓDIGO, ESCOLA — via HYPERLINK
     pra aba da escola —, BAIRRO/CORREDOR, e uma coluna por produto que
     é uma fórmula `INDEX/MATCH` puxando o pedido líquido da "Entrada de
     Dados" pelo código da escola — **não é digitado ali, é derivado**).
   - Linha de controle no fim de cada rota: **"Peso previsto"** = soma de
     todas as colunas de produto **exceto Ovos** (confirmei a fórmula:
     soma F até X pulando a coluna V, que é Ovos) + 3 campos manuais:
     **Peso embarcado (kg)**, **Veículo** (confirmado), **Motorista**.
   - **Isso precisa virar uma tela própria no app** — provavelmente a
     mais usada no dia a dia de quem monta a carga. Ainda não extraí a
     lista completa das 191 escolas por rota (só os cabeçalhos das 18
     rotas + a rota S1–S3 como amostra) — quando formos implementar,
     preciso reler o arquivo `9d130ecd-...v35.xlsx` completo, aba "MAPA
     DE MONTAGEM", pra extrair a sequência real de cada uma das 18 rotas.

3. **Ovos agora é explicitamente "(dz)" — dúzia, não kg.** Confirmado em
   `Entrada de Dados`, nas abas de escola, nas abas de produtor e no
   Mapa de Montagem — todo lugar mostra "Ovos (dz)". O valor pago
   continua sendo quantidade × preço (fórmula não muda), mas nenhum
   total "em kg" pode somar Ovos junto (é por isso que o Peso Previsto do
   Mapa de Montagem exclui a coluna de Ovos explicitamente). **Ação no
   app real**: revisar se algum lugar soma quantidades de produtos
   diferentes num único "kg totais" sem excluir Ovos (o `fmtQty` que
   criei no modelo, por exemplo, não distingue unidade por produto ainda
   — precisa saber que Ovos usa "dz" em vez de "kg").

4. **Validação nova: devolução nunca pode passar do pedido/entrega.**
   **Já está implementado no app real** (as Server Actions
   `saveSchoolReturn`/`saveProducerReturn` já bloqueiam isso) e agora
   também no modelo de demonstração. Nenhuma ação pendente — só
   confirma que o que já foi construído está alinhado com a v35.

5. **Aba "DIFERENÇA" ganhou uma coluna de STATUS automático.** Confirmei
   a fórmula: por produto (não por escola), `DIFERENÇA = TOTAL ENTREGUE
   − TOTAL PEDIDO`; `STATUS = FALTA` (vermelho) se diferença negativa,
   `SOBRA` (amarelo) se positiva, `OK` (verde) se zero. Bom padrão
   visual pra copiar num painel do dashboard ou numa tela própria de
   conferência por produto — ainda não existe equivalente no app real
   nem no modelo.

6. **Mudanças só de organização da planilha (índice, filtro automático,
   cor visual das paradas compartilhadas)** — sem efeito na lógica de
   negócio, não precisam virar funcionalidade.

## Próximo passo exato
**Nada a implementar ainda — o usuário pediu pra só revisar e guardar
essas informações por enquanto.** Quando ele der sinal verde pra
começar a mudança, a ordem sugerida é:
1. Portar pro app real os 8 ajustes já validados no modelo (lista acima).
2. Decidir o que fazer com o Limite Anual PNAE no schema/lib/testes (UI
   já vai sair, mas a lib/testes ficam ou saem?).
3. Extrair a lista completa das 18 rotas do Mapa de Montagem (todas as
   191 escolas, com PAR/SUB/CÓDIGO) a partir do
   `9d130ecd-controle_escolas_produtores_2026_v35.xlsx` e desenhar o
   schema Prisma pra isso (provavelmente uma tabela `Route` + `RouteStop`
   com peso embarcado/veículo/motorista por semana).
4. Ajustar formatação de unidade (kg vs dz) em todo lugar que soma ou
   exibe quantidade de Ovos.
5. Avaliar a "DIFERENÇA" (status FALTA/SOBRA/OK por produto) como tela
   ou painel novo.
6. Decidir se/quando modelar "Cliente" como entidade própria (PMP sendo
   o primeiro) pra sustentar o rótulo "Vendas Merenda Escolar (PMP)".
