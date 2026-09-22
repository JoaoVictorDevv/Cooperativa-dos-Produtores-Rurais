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
