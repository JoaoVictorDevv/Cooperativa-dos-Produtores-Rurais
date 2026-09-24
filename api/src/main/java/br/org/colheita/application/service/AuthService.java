package br.org.colheita.application.service;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.exception.DomainException;
import br.org.colheita.domain.model.Actor;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public final class AuthService {
    public record Session(String accessToken, Instant accessExpiresAt, String refreshToken,
                          Instant refreshExpiresAt, Actor user) {}

    private final IdentityPort identities;
    private final PasswordPort passwords;
    private final TokenPort tokens;
    private final UnitOfWorkPort unitOfWork;
    private final Clock clock;

    public AuthService(IdentityPort identities, PasswordPort passwords, TokenPort tokens,
                       UnitOfWorkPort unitOfWork, Clock clock) {
        this.identities = identities; this.passwords = passwords; this.tokens = tokens;
        this.unitOfWork = unitOfWork; this.clock = clock;
    }

    public Session login(String email, String password, String organizationSlug, String userAgent, String ipAddress) {
        var identity = identities.findForLogin(email.trim().toLowerCase(), organizationSlug)
            .orElseThrow(() -> DomainException.unauthorized("E-mail ou senha inválidos."));
        Instant now = clock.instant();
        if (!identity.active() || (identity.lockedUntil() != null && identity.lockedUntil().isAfter(now))) {
            throw DomainException.unauthorized("Acesso temporariamente indisponível.");
        }
        if (!passwords.matches(password, identity.passwordHash())) {
            identities.registerLoginFailure(identity.userId(), 5, now.plus(Duration.ofMinutes(15)));
            throw DomainException.unauthorized("E-mail ou senha inválidos.");
        }
        Actor actor = toActor(identity);
        return issueSession(actor, userAgent, ipAddress, identity.userId(), identity.organizationId(), null);
    }

    public Session refresh(String refreshToken, String userAgent, String ipAddress) {
        String hash = tokens.hash(refreshToken);
        var stored = identities.findRefreshToken(hash)
            .orElseThrow(() -> DomainException.unauthorized("Sessão inválida."));
        if (stored.revokedAt() != null || !stored.expiresAt().isAfter(clock.instant())) {
            throw DomainException.unauthorized("Sessão expirada.");
        }
        var identity = identities.findIdentity(stored.userId(), stored.organizationId())
            .orElseThrow(() -> DomainException.unauthorized("Usuário sem acesso à cooperativa."));
        return issueSession(toActor(identity), userAgent, ipAddress, stored.userId(), stored.organizationId(), stored.id());
    }

    public void logout(String refreshToken) { identities.revokeRefreshToken(tokens.hash(refreshToken)); }

    private Session issueSession(Actor actor, String userAgent, String ipAddress, UUID userId,
                                 UUID organizationId, UUID replacedTokenId) {
        return unitOfWork.execute(() -> {
            identities.registerLoginSuccess(userId);
            var access = tokens.createAccessToken(actor);
            var refresh = tokens.createRefreshToken();
            UUID refreshId = UUID.randomUUID();
            identities.saveRefreshToken(refreshId, userId, organizationId, refresh.hash(),
                refresh.expiresAt(), userAgent, ipAddress);
            if (replacedTokenId != null) identities.rotateRefreshToken(replacedTokenId, refreshId);
            return new Session(access.value(), access.expiresAt(), refresh.value(), refresh.expiresAt(), actor);
        });
    }

    private Actor toActor(IdentityPort.LoginIdentity identity) {
        return new Actor(identity.userId(), identity.organizationId(), identity.name(), identity.email(),
            identity.role(), identity.permissions());
    }
}

