package com.hrportal.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import com.hrportal.auth.entity.Permission;
import com.hrportal.auth.entity.RefreshToken;
import com.hrportal.auth.entity.Role;
import com.hrportal.auth.entity.UserAccount;
import com.hrportal.auth.repository.RefreshTokenRepository;
import com.hrportal.common.security.JwtProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

/**
 * Issues HS256 access tokens (claims: sub, uid, eid, email, roles, perms, mcp = must-change-password, jti) and opaque
 * refresh tokens. Refresh tokens are random 48-byte values; only their SHA-256 is stored - in MySQL (durable) and in
 * Redis with a TTL (fast lookup, auto-expiry) under hr:auth:refresh:&lt;hash&gt;.
 */
@Service
public class TokenService {
    public static final String REFRESH_PREFIX = "hr:auth:refresh:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtEncoder encoder;
    private final JwtProperties props;
    private final StringRedisTemplate redis;
    private final RefreshTokenRepository refreshTokens;

    public TokenService(SecretKey jwtSecretKey, JwtProperties props, StringRedisTemplate redis, RefreshTokenRepository refreshTokens) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
        this.props = props;
        this.redis = redis;
        this.refreshTokens = refreshTokens;
    }

    public record AccessToken(String value, String jti, Instant expiresAt) { }

    public record IssuedRefreshToken(String value, RefreshToken entity) { }

    public AccessToken issueAccessToken(UserAccount user) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofMinutes(props.getJwt().getAccessTokenMinutes()));
        String jti = UUID.randomUUID().toString();
        List<String> roles = user.getRoles().stream().map(Role::getName).sorted().toList();
        List<String> perms = user.getRoles().stream().flatMap(r -> r.getPermissions().stream()).map(Permission::getCode)
                .distinct().sorted().toList();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder().issuer(props.getJwt().getIssuer()).subject(user.getUsername())
                .issuedAt(now).expiresAt(exp).id(jti)
                .claim("uid", user.getId()).claim("email", user.getEmail())
                .claim("roles", roles).claim("perms", perms).claim("mcp", user.isMustChangePassword());
        if (user.getEmployeeId() != null) claims.claim("eid", user.getEmployeeId());
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
        return new AccessToken(token, jti, exp);
    }

    public IssuedRefreshToken issueRefreshToken(UserAccount user, String accessJti, String ip) {
        byte[] raw = new byte[48];
        RANDOM.nextBytes(raw);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Duration ttl = Duration.ofDays(props.getJwt().getRefreshTokenDays());
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(sha256(value));
        rt.setAccessTokenId(accessJti);
        rt.setExpiresAt(Instant.now().plus(ttl));
        rt.setIpAddress(ip);
        rt = refreshTokens.save(rt);
        redis.opsForValue().set(REFRESH_PREFIX + rt.getTokenHash(), user.getId(), ttl);
        return new IssuedRefreshToken(value, rt);
    }

    public long accessTokenSeconds() {
        return props.getJwt().getAccessTokenMinutes() * 60;
    }

    public void revoke(RefreshToken token) {
        token.setRevokedAt(Instant.now());
        refreshTokens.save(token);
        redis.delete(REFRESH_PREFIX + token.getTokenHash());
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
