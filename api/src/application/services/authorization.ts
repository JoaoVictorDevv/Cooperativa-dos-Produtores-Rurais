import type { Actor, Identity } from "../../domain/actor.js";
import { forbidden } from "../../domain/errors.js";
import type { ColheitaRepository } from "../ports/repository.js";

export class AuthorizationService {
  constructor(private readonly repository: ColheitaRepository) {}

  async actor(identity: Identity, organizationId: string): Promise<Actor> {
    const membership = await this.repository.membership(identity, organizationId);
    if (!membership) throw forbidden("Usuário sem acesso ativo a esta cooperativa.");
    return { ...identity, organizationId, role: membership.role };
  }
}
