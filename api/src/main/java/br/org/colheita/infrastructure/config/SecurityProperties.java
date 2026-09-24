package br.org.colheita.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("colheita.security")
public record SecurityProperties(String jwtSecret, long accessTokenMinutes, long refreshTokenDays,
                                 String corsAllowedOrigins) {
    public SecurityProperties {
        if (jwtSecret == null || jwtSecret.length() < 64) {
            throw new IllegalStateException("JWT_SECRET deve ter no mínimo 64 caracteres.");
        }
    }
}

