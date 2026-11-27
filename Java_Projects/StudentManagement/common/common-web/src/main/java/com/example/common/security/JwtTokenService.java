package com.example.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import javax.crypto.SecretKey;

/** Creates and validates HS256 JWTs. Shared by the auth issuer (Student Service), the gateway and all resource services. */
public class JwtTokenService {
    private final SecretKey key;
    private final JwtProperties props;

    public JwtTokenService(JwtProperties props) {
        this.props = props;
        byte[] bytes = props.getSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.security.jwt.secret must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String createAccessToken(Long userId, String username, List<String> roles, Long studentId) {
        return build(String.valueOf(userId), username, roles, studentId, props.getAccessTokenTtl());
    }

    /** Short-lived token used by a service calling another service (role SERVICE). */
    public String createServiceToken(String serviceName) {
        return build("0", serviceName, List.of("SERVICE"), null, Duration.ofMinutes(5));
    }

    private String build(String subject, String username, List<String> roles, Long studentId, Duration ttl) {
        Instant now = Instant.now();
        var b = Jwts.builder().issuer(props.getIssuer()).subject(subject)
                .claim("username", username).claim("roles", roles)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plus(ttl)));
        if (studentId != null) b.claim("studentId", studentId);
        return b.signWith(key).compact();
    }

    public Optional<AuthenticatedUser> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).requireIssuer(props.getIssuer()).build()
                    .parseSignedClaims(token).getPayload();
            @SuppressWarnings("unchecked") List<String> roles = c.get("roles", List.class);
            Number sid = c.get("studentId", Number.class);
            return Optional.of(new AuthenticatedUser(Long.valueOf(c.getSubject()), c.get("username", String.class),
                    roles == null ? List.of() : roles, sid == null ? null : sid.longValue()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Duration accessTtl() { return props.getAccessTokenTtl(); }
    public Duration refreshTtl() { return props.getRefreshTokenTtl(); }
}
