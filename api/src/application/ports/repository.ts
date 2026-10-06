import type { Identity, Role } from "../../domain/actor.js";

export interface Membership {
  organizationId: string;
  organizationName: string;
  role: Role;
}

export type CatalogName = "products" | "schools" | "producers" | "return_reasons";

export interface ColheitaRepository {
  memberships(identity: Identity): Promise<Membership[]>;
  membership(identity: Identity, organizationId: string): Promise<Membership | null>;
  list(identity: Identity, organizationId: string, table: CatalogName | "weeks" | "prices"): Promise<unknown[]>;
  createCatalog(identity: Identity, organizationId: string, table: CatalogName, input: Record<string, unknown>): Promise<unknown>;
  listMembers(identity: Identity, organizationId: string): Promise<unknown[]>;
  saveMember(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown>;
  createPrice(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown>;
  listProductionMap(identity: Identity, organizationId: string): Promise<unknown[]>;
  upsertProductionMap(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown>;
  createWeek(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown>;
  activateWeek(identity: Identity, organizationId: string, weekId: string): Promise<unknown>;
  upsertSchoolOrder(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown>;
  upsertProducerOrder(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown>;
  createWeeklyCost(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown>;
  recordWarehouseReceipt(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown>;
  loadCycle(identity: Identity, organizationId: string, weekId: string): Promise<unknown>;
  executeCycleCommand(identity: Identity, organizationId: string, weekId: string, command: Record<string, unknown>): Promise<unknown>;
  closeWeek(identity: Identity, organizationId: string, weekId: string): Promise<unknown>;
  audit(identity: Identity, organizationId: string): Promise<unknown[]>;
}
