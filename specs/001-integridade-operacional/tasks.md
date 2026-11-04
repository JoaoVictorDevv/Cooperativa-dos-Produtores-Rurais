# Tarefas — Especificação 001

- [x] T01 Documentar requisitos e critérios de aceite.
- [x] T02 Implementar e testar política de datas (CA-01.1, CA-01.2).
- [x] T03 Impedir semanas abertas concorrentes no banco (CA-01.3).
- [x] T04 Consolidar e impedir devoluções duplicadas (CA-02.*).
- [x] T05 Bloquear fechamento com entregas pendentes e informar o operador (CA-03.*).
- [x] T05.1 Proteger semanas fechadas contra gravações concorrentes no banco (CA-03.5).
- [x] T06 Tornar as mutações críticas e auditorias atômicas (CA-04.*).
- [x] T07 Corrigir período de devoluções no acumulado PNAE (CA-05.*).
- [x] T08 Endurecer credenciais do seed (CA-06.*).
- [x] T09 Validar a migração e os testes de integração em PostgreSQL isolado.

T09 foi executada no banco local `colheita_test`, separado do ambiente de desenvolvimento. Nunca executar esses testes contra produção.

- [x] T10 (2026-09) Substituir a proteção por nome ("test") por prova de banco descartável: executor cria, marca, migra, testa e apaga; teste confere a marca; sem URL nas mensagens. Evidência (26/09/2026): rodar o arquivo direto contra `colheita_test` → recusado; banco com nome no padrão sem a marca → recusado; `npm run test:integration` → banco criado, migrações aplicadas, 5 testes passando, banco apagado, `colheita_test` intocado. Testes unitários da proteção: `src/lib/testing/disposableDb.test.ts`.

## Pendências de segurança e infraestrutura (revisão de 27/09/2026)

Achados da revisão de segurança (`docs/propostas-pendentes.md` §5, §8 e §11).
Todos dependem de armazenamento, credenciais ou infraestrutura, por isso
nenhum foi feito no Next.

- [B] T11 Limite de tentativas de login (precisa de armazenamento compartilhado) — **Responsável: Lucas**.
- [B] T12 Revogação de sessão (logout em todos os aparelhos, usuário desativado) — **Responsável: Lucas** (armazenamento).
- [B] T13 Exigir `ADMIN_PASSWORD` sempre no seed, não só em produção — **Responsável: Lucas** (seed).
- [B] T14 Decidir a migração para o Prisma 7 (alerta alto em `deepmerge-ts`, só na ferramenta de linha de comando, fora do servidor) — **Responsável: Lucas**.
- [B] T15 Backup em produção: infraestrutura, agendamento, retenção e ensaio real de restauração. A verificação só leitura e o roteiro já estão prontos (`scripts/backup-verify.ts`, `docs/backup-e-restauracao.md`) — **Responsável: Lucas**.
- [B] T16 Desativar Ovos no banco real (fora do fluxo ativo, sem apagar histórico) — **Responsável: Lucas**, com confirmação da **Operação**.
