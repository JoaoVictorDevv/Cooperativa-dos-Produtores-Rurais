package br.org.colheita.domain.model;

import java.util.Set;
import java.util.UUID;

public record Actor(UUID userId, UUID organizationId, String name, String email,
                    RoleCode role, Set<String> permissions) {
    public boolean can(String permission) { return permissions.contains(permission); }
}

