package br.org.colheita.application.port.out;

import br.org.colheita.domain.model.PageResult;
import br.org.colheita.domain.model.RoleCode;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface IdentityPort {
    record LoginIdentity(UUID userId, String name, String email, String passwordHash, boolean active,
                         Instant lockedUntil, UUID organizationId, String organizationName,
                         RoleCode role, Set<String> permissions) {}
    record UserView(UUID id, String name, String email, boolean active, RoleCode role,
                    Instant lastLoginAt, Instant createdAt) {}
    record NewUser(String name, String email, String passwordHash, RoleCode role) {}
    record RefreshSession(UUID id, UUID userId, UUID organizationId, Instant expiresAt, Instant revokedAt) {}

    Optional<LoginIdentity> findForLogin(String email, String organizationSlug);
    Optional<LoginIdentity> findIdentity(UUID userId, UUID organizationId);
    void registerLoginSuccess(UUID userId);
    void registerLoginFailure(UUID userId, int maxAttempts, Instant lockedUntil);
    PageResult<UserView> listUsers(UUID organizationId, String search, int page, int size);
    UserView createUser(UUID organizationId, NewUser user);
    UserView updateUser(UUID organizationId, UUID userId, String name, RoleCode role, boolean active);
    void updatePassword(UUID organizationId, UUID userId, String passwordHash);
    long activeAdminCount(UUID organizationId);
    void saveRefreshToken(UUID id, UUID userId, UUID organizationId, String tokenHash,
                          Instant expiresAt, String userAgent, String ipAddress);
    Optional<RefreshSession> findRefreshToken(String tokenHash);
    void rotateRefreshToken(UUID currentId, UUID replacementId);
    void revokeRefreshToken(String tokenHash);
}

