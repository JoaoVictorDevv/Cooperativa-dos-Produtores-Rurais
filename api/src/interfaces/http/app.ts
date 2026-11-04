import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { TokenVerifier } from "../../application/ports/auth.js";
import type { CatalogName, ColheitaRepository } from "../../application/ports/repository.js";
import { AuthorizationService } from "../../application/services/authorization.js";
import { OperationsService } from "../../application/services/operations.js";
import type { Environment } from "../../config/env.js";
import type { Identity } from "../../domain/actor.js";
import { AppError, unauthorized } from "../../domain/errors.js";
import { SupabaseColheitaRepository } from "../../infrastructure/persistence/supabase-repository.js";
import { SupabaseTokenVerifier } from "../../infrastructure/security/supabase-token-verifier.js";
import {
  catalogSchemas,
  cycleCommand,
  memberInput,
  organizationParams,
  priceInput,
  producerOrderInput,
  productionMapInput,
  schoolOrderInput,
  warehouseReceiptInput,
  weeklyCostInput,
  weekInput,
  weekParams,
} from "./schemas.js";

async function identityOf(request: FastifyRequest, verifier: TokenVerifier): Promise<Identity> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  return verifier.verify(header.slice(7));
}

export function buildApp(
  environment: Environment,
  dependencies?: { verifier?: TokenVerifier; repository?: ColheitaRepository },
) {
  const app = Fastify({ logger: environment.NODE_ENV === "test" ? false : { level: environment.LOG_LEVEL } });
  const verifier = dependencies?.verifier ?? new SupabaseTokenVerifier(
    environment.SUPABASE_URL,
    environment.SUPABASE_PUBLISHABLE_KEY,
    environment.SUPABASE_JWT_MODE,
  );
  const repository = dependencies?.repository ?? new SupabaseColheitaRepository(
    environment.SUPABASE_URL,
    environment.SUPABASE_PUBLISHABLE_KEY,
  );
  const authorization = new AuthorizationService(repository);
  const operations = new OperationsService(repository);

  app.register(helmet);
  app.register(cors, { origin: environment.corsOrigins, credentials: true });

  app.get("/health", async () => ({ status: "ok", service: "colheita-api", version: "2.0.0" }));

  app.get("/api/v1/me", async (request) => {
    const identity = await identityOf(request, verifier);
    return { data: { userId: identity.userId, email: identity.email, memberships: await repository.memberships(identity) } };
  });

  const catalogs: CatalogName[] = ["products", "schools", "producers", "return_reasons"];
  for (const catalog of catalogs) {
    const path = catalog === "return_reasons" ? "return-reasons" : catalog;
    app.get(`/api/v1/organizations/:organizationId/${path}`, async (request) => {
      const params = organizationParams.parse(request.params);
      const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
      return { data: await operations.list(actor, catalog) };
    });
    app.post(`/api/v1/organizations/:organizationId/${path}`, async (request, reply) => {
      const params = organizationParams.parse(request.params);
      const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
      const input = catalogSchemas[catalog].parse(request.body) as Record<string, unknown>;
      const data = await operations.createCatalog(actor, catalog, input);
      return reply.code(201).send({ data });
    });
  }

  app.get("/api/v1/organizations/:organizationId/weeks", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.list(actor, "weeks") };
  });

  app.get("/api/v1/organizations/:organizationId/members", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.listMembers(actor) };
  });

  app.put("/api/v1/organizations/:organizationId/members", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.saveMember(actor, memberInput.parse(request.body)) };
  });

  app.get("/api/v1/organizations/:organizationId/prices", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.list(actor, "prices") };
  });

  app.post("/api/v1/organizations/:organizationId/prices", async (request, reply) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    const data = await operations.createPrice(actor, priceInput.parse(request.body));
    return reply.code(201).send({ data });
  });

  app.get("/api/v1/organizations/:organizationId/production-map", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.listProductionMap(actor) };
  });

  app.put("/api/v1/organizations/:organizationId/production-map", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.upsertProductionMap(actor, productionMapInput.parse(request.body)) };
  });

  app.post("/api/v1/organizations/:organizationId/weeks", async (request, reply) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    const data = await operations.createWeek(actor, weekInput.parse(request.body));
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/organizations/:organizationId/weeks/:weekId/activate", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.activateWeek(actor, params.weekId) };
  });

  app.put("/api/v1/organizations/:organizationId/weeks/:weekId/school-orders", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.upsertSchoolOrder(actor, params.weekId, schoolOrderInput.parse(request.body)) };
  });

  app.put("/api/v1/organizations/:organizationId/weeks/:weekId/producer-orders", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.upsertProducerOrder(actor, params.weekId, producerOrderInput.parse(request.body)) };
  });

  app.post("/api/v1/organizations/:organizationId/weeks/:weekId/costs", async (request, reply) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    const data = await operations.createWeeklyCost(actor, params.weekId, weeklyCostInput.parse(request.body));
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/organizations/:organizationId/weeks/:weekId/warehouse-receipts", async (request, reply) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    const data = await operations.recordWarehouseReceipt(actor, params.weekId, warehouseReceiptInput.parse(request.body));
    return reply.code(201).send({ data });
  });

  app.get("/api/v1/organizations/:organizationId/weeks/:weekId/cycle", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.loadCycle(actor, params.weekId) };
  });

  app.post("/api/v1/organizations/:organizationId/weeks/:weekId/commands", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    const command = cycleCommand.parse(request.body) as Record<string, unknown>;
    return { data: await operations.executeCommand(actor, params.weekId, command) };
  });

  app.post("/api/v1/organizations/:organizationId/weeks/:weekId/close", async (request) => {
    const params = weekParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.closeWeek(actor, params.weekId) };
  });

  app.get("/api/v1/organizations/:organizationId/audit", async (request) => {
    const params = organizationParams.parse(request.params);
    const actor = await authorization.actor(await identityOf(request, verifier), params.organizationId);
    return { data: await operations.audit(actor) };
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({
    type: "about:blank",
    title: "Rota não encontrada",
    status: 404,
    code: "ROUTE_NOT_FOUND",
  }));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.type("application/problem+json").code(422).send({
        type: "about:blank",
        title: "Dados inválidos",
        status: 422,
        code: "VALIDATION_ERROR",
        errors: error.issues,
      });
    }
    if (error instanceof AppError) {
      return reply.type("application/problem+json").code(error.statusCode).send({
        type: "about:blank",
        title: error.message,
        status: error.statusCode,
        code: error.code,
        details: error.details,
      });
    }
    request.log.error({ err: error }, "Erro não tratado");
    return reply.type("application/problem+json").code(500).send({ type: "about:blank", title: "Erro interno.", status: 500, code: "INTERNAL_ERROR" });
  });

  return app;
}
