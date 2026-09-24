package br.org.colheita.application.port.out;

import br.org.colheita.domain.model.Actor;
import java.time.Instant;

public interface TokenPort {
    record AccessToken(String value, Instant expiresAt) {}
    record RefreshToken(String value, String hash, Instant expiresAt) {}
    AccessToken createAccessToken(Actor actor);
    RefreshToken createRefreshToken();
    String hash(String token);
}

