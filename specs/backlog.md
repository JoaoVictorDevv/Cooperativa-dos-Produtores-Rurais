# Backlog de especificações

Itens candidatos não são autorização para implementação. Cada um precisa de descoberta com usuários, critérios de aceite e plano próprio antes de entrar em desenvolvimento.

## P1 — antes do piloto

1. **SPEC-002 — Homologação e migração da planilha** *(não confundir com a importação do pedido da prefeitura, que é a spec 009)*
   - importar uma cópia anonimizada;
   - comparar totais por escola, produtor e semana;
   - produzir relatório de divergências sem sobrescrever silenciosamente.
2. **SPEC-003 — Usuários e auditoria operacional**
   - criar, desativar e redefinir acesso;
   - consultar alterações por semana, usuário e entidade;
   - impedir que o último administrador ativo seja removido.
3. **SPEC-004 — Relatórios e exportações** *(promovida na Rodada 2: ver `specs/004-relatorios-exportacoes/`)*
   - definir exatamente quais documentos a prefeitura, a contabilidade e os produtores recebem;
   - gerar arquivos reproduzíveis a partir de semanas fechadas.

4. **Pedido do próximo ciclo sem fechar o atual** *(proposta a decidir; `docs/propostas-pendentes.md` §3 e item L16)*
   - o ciclo real atravessa semanas: pedido na quinta, entrega na segunda;
   - status `PLANEJAMENTO` ou equivalente, sem remover a regra de uma semana aberta para lançamentos;
   - decisão com a **Operação**; schema e API com o **Lucas**.

## P2 — operação em produção

4. **SPEC-005 — Backup, restauração e observabilidade**
   - política de retenção;
   - ensaio de restauração;
   - alertas de falha e registro de saúde do sistema.
5. **SPEC-006 — Revisão regulatória PNAE**
   - validar limites, ciclo anual, descontos e documentos com o responsável contábil/jurídico;
   - versionar regras para não alterar semanas históricas retroativamente.

## P3 — evolução comercial

6. **SPEC-007 — Múltiplas cooperativas**
   - isolamento completo de dados por organização;
   - configurações, usuários e identidade visual próprias;
   - estratégia de cobrança e suporte.


## Em andamento fora do backlog original

- **SPEC-008 — Recebimentos, faltas e fechamento** — regras confirmadas com Seu Paulo; persistência depende do Lucas.
- **SPEC-009 — Importação do pedido da prefeitura (Excel/PDF)**.
- **Etapa 7 — Mapa de Montagem** (rotas, paradas, previsto/embarcado/aceito) — só depois da SPEC-008 integrada e validada. Referência: `docs/referencia-planilha/controle_escolas_produtores_2026_MODELO_v22.xlsx`, aba MAPA DE MONTAGEM (igual à da v20). O que a aba tem:
  - **18 rotas fixas** de um plano de rota oficial da cooperativa (documento externo; o sistema não recalcula nem otimiza):
    - segunda-feira: S1 a S10, 100 escolas;
    - terça-feira: T1 a T8, 91 escolas.
  - **191 escolas e 180 paradas físicas.** 11 pares de escolas dividem o endereço (paradas "4A" e "4B", por exemplo), mas continuam entidades separadas, com pedido, devolução e romaneio próprios.
  - Cada rota tem veículo-base sugerido (caminhão médio, kombi, ou kombi + último trecho de moto), corredor/região e a sequência fixa de escolas na ordem real de entrega.
  - No fim de cada rota: **peso previsto** automático (só produtos em kg, sem Ovos em dúzia) e três campos manuais: peso embarcado, veículo confirmado e motorista.
  - Deve virar uma tela própria no app, provavelmente a mais usada por quem monta a carga. Dado sugerido: tabela de referência com as 18 rotas (nome, dia, veículo-base, escolas na ordem, paradas compartilhadas).
