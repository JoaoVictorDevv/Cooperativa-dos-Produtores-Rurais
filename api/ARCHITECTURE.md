# Arquitetura da API

O fluxo de dependência segue Clean Architecture:

```text
interfaces/rest -> application/service -> application/port -> domain
                              ^                    |
                              |                    v
                    infrastructure/security  infrastructure/persistence
```

- `domain`: regras e tipos sem dependência de Spring;
- `application/port`: contratos de entrada e saída;
- `application/service`: casos de uso e transações;
- `infrastructure/persistence`: PostgreSQL via `JdbcClient`;
- `infrastructure/security`: JWT, BCrypt e configuração de autorização;
- `interfaces/rest`: contratos HTTP, validação e tratamento de erros.

## Autorização

O JWT contém `organization_id`, papel e permissões. Controllers verificam permissões com `@PreAuthorize`. O banco recebe sempre o `organization_id` em todas as consultas, evitando mistura de cooperativas.

| Papel | Capacidades |
|---|---|
| `ADMIN` | usuários, cadastros, operação, financeiro, auditoria e relatórios |
| `OPERADOR` | cadastros, operação, financeiro, auditoria e relatórios |
| `CONSULTA` | leitura de cadastros, operação, financeiro e relatórios |

Senhas usam BCrypt. Access tokens duram 15 minutos. Refresh tokens são aleatórios, armazenados somente como SHA-256 e rotacionados a cada uso.

