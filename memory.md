# Colheita — memória do progresso

## Resumo ultra-curto
Sistema Next.js + Postgres/Prisma implementado seguindo a especificação
formal (CA-*): auth multiusuário (ADMIN/OPERADOR/CONSULTA), semanas
(criar/fechar/reabrir com auditoria), pedido das escolas, produtores
(divisão/pedido/entrega/devolução em tabelas separadas), preços com
histórico, resumo, balanço, conferência, PNAE, histórico e mapa de
produção. Testado de ponta a ponta com Playwright contra Postgres real
— valores financeiros bateram exatos. Build de produção limpo. 23
testes automatizados passando. Já commitado e enviado ao GitHub
(branch `claude/pnae-excel-structure-djoy3c`, commit `511e4d3`).

Falta: exportação de relatórios, importação assistida do Excel via UI,
gestão de usuários pela UI, tela para consultar o AuditLog, testes
automatizados das Server Actions (hoje só validadas manualmente).

## Próximo passo exato
Configurar o deploy: criar banco Postgres no Neon, configurar as env
vars na Vercel (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`), rodar `prisma migrate deploy` + `npm run db:seed`
contra o banco de produção, e fazer o primeiro deploy — para o usuário
e o amigo dele conseguirem acessar pelo navegador.
