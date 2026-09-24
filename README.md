# Colheita

Sistema de gestão do ciclo semanal da Cooperativa dos Produtores Rurais de Petrópolis para o PNAE. Substitui o fluxo operacional mantido em uma grande planilha por lançamentos rastreáveis de pedido, divisão, entrega, devolução e financeiro.

## Nova estrutura de backend

- `api/`: API REST em Java 21 e Spring Boot, organizada em Clean Architecture;
- `database/`: PostgreSQL com migrações, papéis técnicos, permissões, auditoria e inicialização local;
- `/`: redireciona diretamente para `/login`, sem landing page pública.

Veja as instruções específicas em [`api/README.md`](./api/README.md) e [`database/README.md`](./database/README.md).

## Estado do produto

O projeto está em preparação para o primeiro piloto. Ainda não deve ser publicado como produção sem:

- aplicar as migrações em um PostgreSQL de homologação;
- executar os testes de integração nesse banco isolado;
- validar um ciclo semanal completo em paralelo com a planilha;
- confirmar backup, responsáveis e credenciais de produção.

As decisões e os critérios de aceite ficam em [`specs/`](./specs/README.md). A especificação ativa é [`SPEC-001 — Integridade operacional`](./specs/001-integridade-operacional/spec.md).

## Módulos existentes

- autenticação com papéis `ADMIN`, `OPERADOR` e `CONSULTA`;
- semanas operacionais, fechamento e reabertura auditada;
- pedidos e entregas das escolas;
- divisão, pedidos, entregas e devoluções dos produtores;
- histórico de preços;
- custos, resumo, balanço e conferência financeira;
- mapa de produção e acompanhamento anual PNAE.

## Ambiente local

Requisitos: Node.js, npm e PostgreSQL.

1. Instale as dependências com `npm ci`.
2. Copie `.env.example` para `.env` e preencha valores locais.
3. Aplique as migrações com `npx prisma migrate deploy`.
4. Carregue os cadastros iniciais com `npm run db:seed`.
5. Inicie com `npm run dev`.

Nesta máquina, o banco isolado de desenvolvimento fica em `.local/` e usa a porta 5433. Depois de reiniciar o Windows, execute `npm run db:local:start` antes de `npm run dev`. Para encerrá-lo manualmente, use `npm run db:local:stop`.

Nunca use um banco de produção para testes. Os testes de integração limpam completamente o banco indicado em `.env.test`.

## Verificações

- `npm test`: testes unitários, sem necessidade de banco;
- `npm run test:integration`: testes de persistência; exige um PostgreSQL isolado em `.env.test`;
- `npm run lint`: análise estática;
- `npm run build`: build de produção;
- `npx prisma validate`: validação do modelo de dados.

## Dados e segurança

O arquivo de seed contém dados operacionais de escolas. O repositório deve permanecer privado enquanto esses dados não forem substituídos por uma amostra anonimizada. Em produção, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL` e `SESSION_SECRET` são obrigatórios; não reutilize os valores de exemplo.
