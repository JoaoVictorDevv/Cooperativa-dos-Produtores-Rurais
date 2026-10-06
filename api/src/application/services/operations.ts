import { canManageMembers, canWrite, type Actor } from "../../domain/actor.js";
import { forbidden } from "../../domain/errors.js";
import type { CatalogName, ColheitaRepository } from "../ports/repository.js";

export class OperationsService {
  constructor(private readonly repository: ColheitaRepository) {}

  list(actor: Actor, table: CatalogName | "weeks" | "prices") {
    return this.repository.list(actor, actor.organizationId, table);
  }

  createCatalog(actor: Actor, table: CatalogName, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.createCatalog(actor, actor.organizationId, table, input);
  }

  listMembers(actor: Actor) {
    if (!canManageMembers(actor.role)) throw forbidden();
    return this.repository.listMembers(actor, actor.organizationId);
  }

  saveMember(actor: Actor, input: Record<string, unknown>) {
    if (!canManageMembers(actor.role)) throw forbidden();
    return this.repository.saveMember(actor, actor.organizationId, input);
  }

  createPrice(actor: Actor, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.createPrice(actor, actor.organizationId, input);
  }

  listProductionMap(actor: Actor) {
    return this.repository.listProductionMap(actor, actor.organizationId);
  }

  upsertProductionMap(actor: Actor, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.upsertProductionMap(actor, actor.organizationId, input);
  }

  createWeek(actor: Actor, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.createWeek(actor, actor.organizationId, input);
  }

  activateWeek(actor: Actor, weekId: string) {
    this.requireWrite(actor);
    return this.repository.activateWeek(actor, actor.organizationId, weekId);
  }

  upsertSchoolOrder(actor: Actor, weekId: string, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.upsertSchoolOrder(actor, actor.organizationId, weekId, input);
  }

  upsertProducerOrder(actor: Actor, weekId: string, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.upsertProducerOrder(actor, actor.organizationId, weekId, input);
  }

  createWeeklyCost(actor: Actor, weekId: string, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.createWeeklyCost(actor, actor.organizationId, weekId, input);
  }

  recordWarehouseReceipt(actor: Actor, weekId: string, input: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.recordWarehouseReceipt(actor, actor.organizationId, weekId, input);
  }

  loadCycle(actor: Actor, weekId: string) {
    return this.repository.loadCycle(actor, actor.organizationId, weekId);
  }

  executeCommand(actor: Actor, weekId: string, command: Record<string, unknown>) {
    this.requireWrite(actor);
    return this.repository.executeCycleCommand(actor, actor.organizationId, weekId, command);
  }

  closeWeek(actor: Actor, weekId: string) {
    this.requireWrite(actor);
    return this.repository.closeWeek(actor, actor.organizationId, weekId);
  }

  audit(actor: Actor) {
    if (actor.role === "CONSULTA") throw forbidden();
    return this.repository.audit(actor, actor.organizationId);
  }

  private requireWrite(actor: Actor) {
    if (!canWrite(actor.role)) throw forbidden();
  }
}
