# Para o Lucas — o que foi feito e o que falta

**Atualizado em 27/09/2026.** Este é o guia de entrada. Os detalhes técnicos
estão nos links; aqui fica o mapa.

Três ideias resumem o estado atual:

1. **O app que roda hoje continua no modelo antigo.** A cobrança é
   `(pedido − devolução) × preço`, sobre as tabelas atuais do Prisma. Ele
   funciona e está testado.
2. **O modelo novo está pronto só "no papel e em memória".** Isso inclui
   entrega real por escola, complementos, faltas e cobrança pelo aceito na
   escola. Regras, telas, PDFs e casos de teste existem, mas nada disso é
   gravado. **O que falta é banco e API, que são a sua parte.**
3. **As pastas `api/` e `database/` não foram tocadas.** O mesmo vale para
   schema, migrações, seed, conexão, credenciais e infraestrutura do banco.
   Nenhum banco real foi consultado ou alterado.

---

## 1. O que já foi feito, em palavras simples

### 1.1 Funciona hoje, no app atual

| O quê | Onde ver | Como se sabe que funciona |
|---|---|---|
| Importar o pedido da prefeitura (Excel com várias abas e PDF com texto), com conferência antes de gravar | Pedido das Escolas → "+ Importar pedido da prefeitura" | `specs/009…/tasks.md`, testes em `src/lib/import/` |
| Gerar os pedidos aos produtores a partir da divisão, com prévia e sem sobrescrever em silêncio | Produtores → "+ Gerar pedidos…" | `specs/010…/tasks.md` |
| PDFs da semana, ZIP e romaneio com data/horário real e 4 vias | Semana → Documentos | `specs/004…/tasks.md` |
| Total a cobrar = soma das linhas já arredondadas (só em ciclos novos) | Resumo, Balanço | `src/lib/roundingPolicy.test.ts` |
| Trava contra dois salvamentos simultâneos (ex.: devolução maior que a entrega) | todas as telas de lançamento | `src/lib/concurrency.integration.test.ts` (antes 40/40 corridas erradas, agora 0/40) |
| Revisão de segurança: cada página checa a sessão, erros sem dado sensível, validação repetida no servidor | todo o app | `docs/propostas-pendentes.md` §11 |
| Tela "Validar este ciclo fechado" (só leitura, só ADMIN) | Semana fechada → link no fim da página | `docs/validacao-ciclo-fechado.md` |
| Verificador de backup (só leitura: conta linhas e compara conteúdo antes e depois de restaurar) | `scripts/backup-verify.ts` | `docs/backup-e-restauracao.md` |

### 1.2 Pronto, mas só com dado fictício (espera o banco)

| O quê | Onde está | Estado |
|---|---|---|
| Regras do ciclo novo: aceito no galpão, aceito na escola, falta, excedente, fechamento | `src/lib/domain/cycle.ts` | 40 testes |
| Comandos: entrega inicial, complemento, correção, falta em resolução, encerrar sem atendimento, revogar | `src/lib/domain/cycleLedger.ts` | 23 testes (duplo clique, conflito de versão, ciclo fechado) |
| "Tomada" onde a API vai se ligar | `src/lib/cycleCore/repository.ts` (`CycleCoreRepository`) | só existe a versão em memória |
| Telas de complementos e faltas | `/complementos-faltas` (demonstração; nada é gravado) | testadas pela interface |
| PDFs e ZIP pelo modelo novo | demonstração, na mesma tela | testados |
| **Pacote de aceitação para a API Java**: 15 cenários e 5 cálculos em JSON, mais o contrato dos comandos em JSON Schema | `docs/aceitacao/` | gerado pelo código (`scripts/export-acceptance.ts`) |

A regra do ciclo novo está em `specs/008-recebimentos-faltas-fechamento/spec.md`
(RN-01 a RN-21, todas confirmadas pela operação).

### 1.3 Planilha de referência

A referência operacional agora é a **MODELO v22**
(`docs/referencia-planilha/`). A v22 **não muda nenhum cálculo**. Ela mostra
o "Aceito (kg) = Entrega − Devolução" nas fichas de produtor, corrige o texto
do Índice e ajusta a impressão.

As diferenças entre a v22 e o app estão em
`docs/referencia-planilha/atualizacao_v20_para_v22.md`. Resumo:

- a única diferença de valor possível é de centavos, pelo arredondamento por
  linha, já decidido a favor do app;
- as outras diferenças são de apresentação ou de forma de registro.

---

## 2. O que falta, e de quem depende

### 2.1 Lucas: banco e API (é o que destrava o resto)

| # | O quê | Detalhe |
|---|---|---|
| 1 | **Gravar a entrega por escola/produto**: eventos inicial e complemento, com origem, rejeição, perda, data/hora real e quem recebeu | `docs/propostas-pendentes.md` §9, item 1 |
| 2 | **Gravar a decisão de falta** (em resolução ou encerrada sem atendimento), com versão | §9, item 2 |
| 3 | **Auditoria** na mesma transação: antes/depois, motivo, usuário | §9, item 3 |
| 4 | **Endpoint de comando e endpoint de leitura do ciclo**, no formato de `cycleLedger.ts` | §9, item 4; contrato em `docs/aceitacao/contrato-comandos.schema.json` |
| 5 | **Metodologia gravada por ciclo** (antigo × aceite escolar). Os ciclos antigos ficam no antigo para sempre | §10, item 2 |
| 6 | **A API passar no pacote de aceitação** (`docs/aceitacao/casos.json`) | `docs/aceitacao/README.md` |
| 7 | **Correções na API atual**: preço/desconto congelados em correções; devolução ≤ entrega com trava contra corrida; auditoria com antes/depois | §7.5 e §11.6 |
| 8 | **Contrato Next ↔ API**: autenticação, IDs, dados históricos | §7 |
| 9 | **Segurança e infraestrutura**: limite de tentativas de login, revogação de sessão, `ADMIN_PASSWORD` obrigatória no seed, decisão sobre o Prisma 7 (alerta alto em `deepmerge-ts`, só na ferramenta de linha de comando), backup em produção com ensaio de restauração | §5, §8, §11 |
| 10 | **Desativar Ovos** no banco real | §4 |
| 11 | Arredondamento por linha também na view `v_week_financial_summary`, só para ciclos novos | §8 |

### 2.2 Operação ou prefeitura

- **Pedido oficial da prefeitura** (Excel/PDF), para validar a importação com
  o arquivo de verdade.
- **Um ciclo real fechado validado:** um ADMIN abre "Validar este ciclo
  fechado". A parte do galpão, os custos e a diferença podem ser conferidos
  hoje. A cobrança por escola **não pode ser validada** com nenhum ciclo
  antigo, porque ele não tem entrega por escola registrada.
- **Decisão sobre a v22, item 8:** um complemento que chega na mesma viagem
  sai em romaneio próprio no app, ou vai junto no romaneio inicial como na
  planilha?

### 2.3 Claude, quando o seu lado estiver pronto

1. Escrever o adaptador da `CycleCoreRepository` para a API. As telas não
   mudam.
2. Ligar `/complementos-faltas` ao banco.
3. Trocar a fonte dos PDFs e das telas Resumo, Balanço e Diferença nos ciclos
   do modelo novo (`DOCUMENT_SOURCES`, `methodologyOfRealCycle()`).
4. Fechar a semana pelos estados da spec 008.
5. Teste de volume com 191 escolas.
6. Só depois, a Etapa 7 (Mapa de Montagem).

Pequenos, podem ser feitos a qualquer momento: colunas "Aceito" e "Preço
líquido" e linha de horário na ficha impressa do produtor (v22, item 5).

---

## 3. Como conferir sozinho

```bash
service postgresql start   # só no container; na sua máquina, o Postgres local
npx tsc --noEmit && npx eslint
npx vitest run --exclude "**/*.integration.test.ts"   # 220 testes, sem banco
npm run test:integration   # cria um banco descartável, roda 21 testes e apaga o banco
npm run build
```

Os testes de integração não usam o banco citado no `.env.test`: ele só
indica o servidor Postgres. O executor cria nesse servidor um banco
`colheita_descartavel_*` com uma marca própria, roda os testes nele e o apaga
no fim. Só se apaga banco que tenha essa marca; um nome com "test" não basta.

## 4. Onde está cada coisa

- Regras e critérios de aceite: `specs/` (comece por `specs/README.md`)
- Tudo que depende de você, item por item: `docs/propostas-pendentes.md`
  (o "Para o Lucas — resumo" fica no fim)
- Histórico da sessão e ponto de retomada: `docs/relatorio-sessao.md`
- Plano e lista única de etapas: `docs/plano-de-implementacao.md`
- Planilha de referência e o que mudou: `docs/referencia-planilha/`
