# Colheita — estado atual

## Resumo

O projeto adotou desenvolvimento orientado por especificações. A primeira entrega está em `specs/001-integridade-operacional` e endurece as regras necessárias antes do piloto:

- datas coerentes e somente uma semana aberta;
- fechamento bloqueado por entregas pendentes;
- proteção no banco contra gravações em semana fechada;
- devoluções únicas por origem/produto/semana;
- mutações críticas e auditoria na mesma transação;
- acumulado PNAE associado ao período da entrega;
- credenciais de seed protegidas.

Verificações locais concluídas: 24 testes unitários, 5 testes de integração em `colheita_test`, TypeScript, ESLint, schema Prisma e build de produção. O teste de interface confirmou login, todas as rotas principais, criação e validação de semana, pedido escolar, confirmação de entrega, fechamento, resumo, histórico e bloqueio de fechamento com pendência.

O ambiente local desta máquina possui um PostgreSQL isolado em `.local/postgres-data`, porta 5433, com migrações e seed aplicados. O banco e o `.env` são ignorados pelo Git. Após reiniciar o Windows, usar `npm run db:local:start` antes do servidor web.

## Próximo marco obrigatório

Executar um ciclo semanal de homologação com usuários reais, em paralelo com a planilha, antes de qualquer deploy de produção.

## Próximas especificações sugeridas

1. importação assistida e anonimização dos dados da planilha;
2. gestão de usuários e tela de auditoria;
3. relatórios e exportação financeira;
4. backup, restauração e observabilidade;
5. isolamento por cooperativa para evolução comercial.
