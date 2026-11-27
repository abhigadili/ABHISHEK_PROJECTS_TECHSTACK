package com.fooddelivery.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/** Issues and validates HS256 JWTs: access tokens, refresh tokens and short-lived service tokens. */
@Component
public class JwtService {
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";
    public static final String TYPE_SERVICE = "service";

    private final JwtProperties props;
    private final SecretKey key;

    public JwtService(JwtProperties props) {
        this.props = props;
        if (props.secret() == null || props.secret().length() < 32) {
            throw new IllegalStateException("food.jwt.secret (JWT_SECRET) must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(props.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String issueAccessToken(long userId, String username, List<String> roles, List<String> permissions) {
        return build(String.valueOf(userId), username, roles, permissions, TYPE_ACCESS, props.accessTtl().toSeconds());
    }

    public String issueRefreshToken(long userId, String username) {
        return build(String.valueOf(userId), username, List.of(), List.of(), TYPE_REFRESH, props.refreshTtl().toSeconds());
    }

    public String issueServiceToken(String serviceName, long ttlSeconds) {
        return build("0", serviceName, List.of(Roles.SERVICE), List.of(), TYPE_SERVICE, ttlSeconds);
    }

    private String build(String sub, String username, List<String> roles, List<String> perms, String type, long ttlSeconds) {
        Instant now = Instant.now();
        return Jwts.builder().id(UUID.randomUUID().toString()).issuer(props.issuer()).subject(sub)
                .claim("username", username).claim("roles", roles).claim("perms", perms).claim("typ", type)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .signWith(key).compact();
    }

    /** Verifies signature, issuer and expiry; throws {@link io.jsonwebtoken.JwtException} when invalid. */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).requireIssuer(props.issuer()).build().parseSignedClaims(token).getPayload();
    }

    @SuppressWarnings("unchecked")
    public AuthUser toAuthUser(Claims c) {
        List<String> roles = c.get("roles", List.class) == null ? List.of() : (List<String>) c.get("roles", List.class);
        List<String> perms = c.get("perms", List.class) == null ? List.of() : (List<String>) c.get("perms", List.class);
        return new AuthUser(Long.parseLong(c.getSubject()), c.get("username", String.class), roles, perms, c.getId());
    }

    public JwtProperties properties() { return props; }
}
