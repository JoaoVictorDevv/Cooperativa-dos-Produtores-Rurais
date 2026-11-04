import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CatalogName, ColheitaRepository, Membership } from "../../application/ports/repository.js";
import { roles, type Identity, type Role } from "../../domain/actor.js";
import { AppError, notFound } from "../../domain/errors.js";

type DbError = { code?: string; message: string; details?: string; hint?: string };
type OrganizationRelation = { name: string } | Array<{ name: string }>;
type MembershipRow = { organization_id: string; role: unknown; organizations: OrganizationRelation };

export class SupabaseColheitaRepository implements ColheitaRepository {
  constructor(private readonly url: string, private readonly publishableKey: string) {}

  async memberships(identity: Identity): Promise<Membership[]> {
    const { data, error } = await this.client(identity)
      .from("organization_members")
      .select("organization_id, role, organizations!inner(name)")
      .eq("active", true);
    this.raise(error);
    return ((data ?? []) as unknown as MembershipRow[]).map((row) => ({
      organizationId: row.organization_id,
      organizationName: this.organizationName(row.organizations),
      role: this.role(row.role),
    }));
  }

  async membership(identity: Identity, organizationId: string): Promise<Membership | null> {
    const { data, error } = await this.client(identity)
      .from("organization_members")
      .select("organization_id, role, organizations!inner(name)")
      .eq("organization_id", organizationId)
      .eq("user_id", identity.userId)
      .eq("active", true)
      .maybeSingle();
    this.raise(error);
    if (!data) return null;
    const row = data as unknown as MembershipRow;
    return {
      organizationId: row.organization_id,
      organizationName: this.organizationName(row.organizations),
      role: this.role(row.role),
    };
  }

  async list(identity: Identity, organizationId: string, table: CatalogName | "weeks" | "prices"): Promise<unknown[]> {
    const { data, error } = await this.client(identity).from(table).select("*").eq("organization_id", organizationId).order("created_at");
    this.raise(error);
    return data ?? [];
  }

  async createCatalog(identity: Identity, organizationId: string, table: CatalogName, input: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).from(table).insert({ ...input, organization_id: organizationId }).select().single();
    this.raise(error);
    return data;
  }

  async listMembers(identity: Identity, organizationId: string): Promise<unknown[]> {
    const { data, error } = await this.client(identity).from("organization_members")
      .select("organization_id, user_id, role, active, profiles!organization_members_profile_fk(name, email)")
      .eq("organization_id", organizationId).order("created_at");
    this.raise(error);
    return data ?? [];
  }

  async saveMember(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).from("organization_members")
      .upsert({ ...input, organization_id: organizationId }, { onConflict: "organization_id,user_id" })
      .select().single();
    this.raise(error);
    return data;
  }

  async createPrice(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown> {
    return this.rpc(identity, "set_product_price", { p_organization_id: organizationId, p_input: input });
  }

  async listProductionMap(identity: Identity, organizationId: string): Promise<unknown[]> {
    const { data, error } = await this.client(identity).from("production_map_entries").select("*")
      .eq("organization_id", organizationId).order("cycle_year").order("month");
    this.raise(error);
    return data ?? [];
  }

  async upsertProductionMap(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).from("production_map_entries")
      .upsert({ ...input, organization_id: organizationId }, { onConflict: "organization_id,cycle_year,month,producer_id,product_id" })
      .select().single();
    this.raise(error);
    return data;
  }

  async createWeek(identity: Identity, organizationId: string, input: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).from("weeks").insert({
      ...input,
      organization_id: organizationId,
      status: "PLANEJAMENTO",
      billing_method: "ACEITE_ESCOLAR",
    }).select().single();
    this.raise(error);
    return data;
  }

  async activateWeek(identity: Identity, organizationId: string, weekId: string): Promise<unknown> {
    return this.rpc(identity, "activate_week", { p_organization_id: organizationId, p_week_id: weekId });
  }

  async upsertSchoolOrder(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown> {
    const payload = { ...input, organization_id: organizationId, week_id: weekId };
    const { data, error } = await this.client(identity).from("school_orders").upsert(payload, {
      onConflict: "organization_id,week_id,school_id,product_id",
    }).select().single();
    this.raise(error);
    return data;
  }

  async upsertProducerOrder(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown> {
    const payload = { ...input, organization_id: organizationId, week_id: weekId };
    const { data, error } = await this.client(identity).from("producer_orders").upsert(payload, {
      onConflict: "organization_id,week_id,producer_id,product_id",
    }).select().single();
    this.raise(error);
    return data;
  }

  async createWeeklyCost(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).from("weekly_costs")
      .insert({ ...input, organization_id: organizationId, week_id: weekId }).select().single();
    this.raise(error);
    return data;
  }

  async recordWarehouseReceipt(identity: Identity, organizationId: string, weekId: string, input: Record<string, unknown>): Promise<unknown> {
    return this.rpc(identity, "record_warehouse_receipt", {
      p_organization_id: organizationId,
      p_week_id: weekId,
      p_input: input,
    });
  }

  async loadCycle(identity: Identity, organizationId: string, weekId: string): Promise<unknown> {
    return this.rpc(identity, "get_cycle_ledger", { p_organization_id: organizationId, p_week_id: weekId });
  }

  async executeCycleCommand(identity: Identity, organizationId: string, weekId: string, command: Record<string, unknown>): Promise<unknown> {
    return this.rpc(identity, "execute_cycle_command", {
      p_organization_id: organizationId,
      p_week_id: weekId,
      p_command: command,
    });
  }

  async closeWeek(identity: Identity, organizationId: string, weekId: string): Promise<unknown> {
    return this.rpc(identity, "close_week", { p_organization_id: organizationId, p_week_id: weekId });
  }

  async audit(identity: Identity, organizationId: string): Promise<unknown[]> {
    const { data, error } = await this.client(identity).from("audit_logs").select("*")
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500);
    this.raise(error);
    return data ?? [];
  }

  private client(identity: Identity): SupabaseClient {
    return createClient(this.url, this.publishableKey, {
      global: { headers: { Authorization: `Bearer ${identity.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  private async rpc(identity: Identity, name: string, parameters: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client(identity).rpc(name, parameters);
    this.raise(error);
    if (data === null) throw notFound();
    return data;
  }

  private role(value: unknown): Role {
    if (typeof value === "string" && roles.includes(value as Role)) return value as Role;
    throw new AppError("Papel de usuário inválido no banco.", 500, "INVALID_ROLE");
  }

  private organizationName(value: OrganizationRelation): string {
    const organization = Array.isArray(value) ? value[0] : value;
    if (organization?.name) return organization.name;
    throw new AppError("Organização inválida no banco.", 500, "INVALID_ORGANIZATION");
  }

  private raise(error: DbError | null): asserts error is null {
    if (!error) return;
    const status = error.code === "23505" || error.code === "P0001" ? 409 : error.code === "42501" ? 403 : 400;
    throw new AppError(error.message, status, error.code ?? "DATABASE_ERROR", error.details);
  }
}
