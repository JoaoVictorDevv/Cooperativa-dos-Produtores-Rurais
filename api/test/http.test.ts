import { describe, expect, it } from "vitest";
import type { TokenVerifier } from "../src/application/ports/auth.js";
import type { ColheitaRepository } from "../src/application/ports/repository.js";
import type { Environment } from "../src/config/env.js";
import { buildApp } from "../src/interfaces/http/app.js";

const environment: Environment = {
  NODE_ENV: "test",
  PORT: 8080,
  HOST: "127.0.0.1",
  LOG_LEVEL: "silent",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
  SUPABASE_JWT_MODE: "jwks",
  corsOrigins: ["http://localhost:3000"],
};

const verifier: TokenVerifier = {
  verify: async (accessToken) => ({ userId: "00000000-0000-4000-8000-000000000099", email: "teste@example.com", accessToken }),
};

const repository: ColheitaRepository = {
  memberships: async () => [{ organizationId: "00000000-0000-4000-8000-000000000001", organizationName: "Cooperativa", role: "CONSULTA" }],
  membership: async () => ({ organizationId: "00000000-0000-4000-8000-000000000001", organizationName: "Cooperativa", role: "CONSULTA" }),
  list: async () => [],
  createCatalog: async () => ({}),
  listMembers: async () => [],
  saveMember: async () => ({}),
  createPrice: async () => ({}),
  listProductionMap: async () => [],
  upsertProductionMap: async () => ({}),
  createWeek: async () => ({}),
  activateWeek: async () => ({}),
  upsertSchoolOrder: async () => ({}),
  upsertProducerOrder: async () => ({}),
  createWeeklyCost: async () => ({}),
  recordWarehouseReceipt: async () => ({}),
  loadCycle: async () => ({}),
  executeCycleCommand: async () => ({}),
  closeWeek: async () => ({}),
  audit: async () => [],
};

describe("HTTP", () => {
  it("expõe saúde sem autenticação", async () => {
    const app = buildApp(environment, { verifier, repository });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "colheita-api" });
    await app.close();
  });

  it("recusa rota protegida sem bearer token", async () => {
    const app = buildApp(environment, { verifier, repository });
    const response = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    await app.close();
  });

  it("impede CONSULTA de cadastrar produto", async () => {
    const app = buildApp(environment, { verifier, repository });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/00000000-0000-4000-8000-000000000001/products",
      headers: { authorization: "Bearer valid-token" },
      payload: { slug: "alface", name: "Alface", unit: "kg" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORBIDDEN" });
    await app.close();
  });
});
