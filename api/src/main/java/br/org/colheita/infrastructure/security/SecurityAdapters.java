package br.org.colheita.infrastructure.security;

import br.org.colheita.application.port.out.*;
import br.org.colheita.domain.model.Actor;
import br.org.colheita.infrastructure.config.SecurityProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public final class SecurityAdapters implements PasswordPort, TokenPort, UnitOfWorkPort {
    private final PasswordEncoder encoder; private final JwtEncoder jwtEncoder; private final SecurityProperties properties;
    private final TransactionTemplate transactions; private final Clock clock; private final SecureRandom random=new SecureRandom();
    public SecurityAdapters(PasswordEncoder encoder,JwtEncoder jwtEncoder,SecurityProperties properties,TransactionTemplate transactions,Clock clock){this.encoder=encoder;this.jwtEncoder=jwtEncoder;this.properties=properties;this.transactions=transactions;this.clock=clock;}
    @Override public String encode(String raw){return encoder.encode(raw);}
    @Override public boolean matches(String raw,String encoded){return encoder.matches(raw,encoded);}
    @Override public AccessToken createAccessToken(Actor actor){Instant now=clock.instant();Instant expiry=now.plus(Duration.ofMinutes(properties.accessTokenMinutes()));JwtClaimsSet claims=JwtClaimsSet.builder().issuer("colheita-api").issuedAt(now).expiresAt(expiry).subject(actor.userId().toString()).claim("organization_id",actor.organizationId().toString()).claim("name",actor.name()).claim("email",actor.email()).claim("role",actor.role().name()).claim("permissions",actor.permissions()).id(UUID.randomUUID().toString()).build();var header=JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();return new AccessToken(jwtEncoder.encode(JwtEncoderParameters.from(header,claims)).getTokenValue(),expiry);}
    @Override public RefreshToken createRefreshToken(){byte[] bytes=new byte[48];random.nextBytes(bytes);String value=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);return new RefreshToken(value,hash(value),clock.instant().plus(Duration.ofDays(properties.refreshTokenDays())));}
    @Override public String hash(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    @Override public <T>T execute(java.util.function.Supplier<T> work){return transactions.execute(status->work.get());}
    @Override public void execute(Runnable work){transactions.executeWithoutResult(status->work.run());}
    public static SecretKeySpec secretKey(SecurityProperties p){return new SecretKeySpec(p.jwtSecret().getBytes(StandardCharsets.UTF_8),"HmacSHA256");}
}

