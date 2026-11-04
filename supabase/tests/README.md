# Teste de aceitação do banco

Depois de `npx supabase db reset`, execute em uma instância local descartável:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 -f supabase/tests/manual/acceptance.sql
```

O teste roda dentro de uma transação e termina com `rollback`: não deixa dados.
Ele cobre isolamento entre cooperativas, ciclo vazio, pedido zero, caso
200/180/170, decisão de falta, preço e auditoria. Nunca execute contra
produção.
