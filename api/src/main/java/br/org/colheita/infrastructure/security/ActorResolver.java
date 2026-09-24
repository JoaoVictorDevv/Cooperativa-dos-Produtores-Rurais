package br.org.colheita.infrastructure.security;

import br.org.colheita.domain.model.*;
import java.util.HashSet;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

public final class ActorResolver {
    private ActorResolver() {}
    public static Actor from(Jwt jwt){return new Actor(UUID.fromString(jwt.getSubject()),UUID.fromString(jwt.getClaimAsString("organization_id")),jwt.getClaimAsString("name"),jwt.getClaimAsString("email"),RoleCode.valueOf(jwt.getClaimAsString("role")),new HashSet<>(jwt.getClaimAsStringList("permissions")));}
}

