# Banco PostgreSQL do Colheita

Banco independente do frontend e preparado para ser consumido pela API Java.

## Segurança

- `colheita_owner`: proprietário técnico, sem login;
- `colheita_migrator`: aplica migrações e nunca deve ser usado pela aplicação;
- `colheita_runtime`: conexão da API, com CRUD somente no schema `colheita`;
- `colheita_readonly`: relatórios e suporte, somente leitura;
- usuários do produto são armazenados em `users` e recebem papéis por cooperativa em `organization_members`;
- papéis e permissões são normalizados em `roles`, `permissions` e `role_permissions`.

## Inicialização local

1. Copie `.env.example` para `.env` e troque todas as senhas.
2. Execute `docker compose --env-file .env up -d` dentro desta pasta.
3. A API usa a porta `5434` no ambiente local.

Os scripts em `bootstrap` criam credenciais de infraestrutura e o administrador inicial. As migrações em `migrations` são versionadas e não devem ser alteradas depois de aplicadas.

## Regras protegidas no banco

- no máximo uma semana aberta por cooperativa;
- nenhuma gravação operacional em semana fechada;
- datas coerentes para semanas e preços;
- preços não podem se sobrepor para o mesmo produto;
- quantidades e valores não podem ser negativos;
- devoluções e lançamentos são únicos por origem, produto e semana;
- deleções físicas de semanas não são concedidas à role da API.

