# Colheita API Java

API REST em Java 21 e Spring Boot 4.1, separada do frontend.

## Executar

1. Inicialize o PostgreSQL pela pasta `database`.
2. Configure as variáveis descritas em `.env.example`.
3. Com Maven 3.6.3 ou superior, execute `mvn spring-boot:run`.
4. Saúde: `GET http://localhost:8080/actuator/health`.

Base da API: `/api/v1`. Login: `POST /api/v1/auth/login`.

Consulte `ARCHITECTURE.md` para as camadas e `docs/openapi.yaml` para os endpoints.

