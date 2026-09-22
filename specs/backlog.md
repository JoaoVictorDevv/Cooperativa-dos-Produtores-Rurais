# Backlog de especificações

Itens candidatos não são autorização para implementação. Cada um precisa de descoberta com usuários, critérios de aceite e plano próprio antes de entrar em desenvolvimento.

## P1 — antes do piloto

1. **SPEC-002 — Homologação e migração da planilha**
   - importar uma cópia anonimizada;
   - comparar totais por escola, produtor e semana;
   - produzir relatório de divergências sem sobrescrever silenciosamente.
2. **SPEC-003 — Usuários e auditoria operacional**
   - criar, desativar e redefinir acesso;
   - consultar alterações por semana, usuário e entidade;
   - impedir que o último administrador ativo seja removido.
3. **SPEC-004 — Relatórios e exportações**
   - definir exatamente quais documentos a prefeitura, a contabilidade e os produtores recebem;
   - gerar arquivos reproduzíveis a partir de semanas fechadas.

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

