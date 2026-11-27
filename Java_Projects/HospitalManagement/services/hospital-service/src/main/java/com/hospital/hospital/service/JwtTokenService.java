package com.hospital.hospital.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import com.hospital.hospital.domain.UserAccount;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

/** Issues the HS256 access tokens that the gateway and every service validate. */
@Service
public class JwtTokenService {
    private final JwtEncoder encoder;
    private final Duration ttl;

    public JwtTokenService(SecretKey jwtSecretKey, @Value("${hospital.security.jwt.expiry-minutes}") long expiryMinutes) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
        this.ttl = Duration.ofMinutes(expiryMinutes);
    }

    public long ttlSeconds() {
        return ttl.toSeconds();
    }

    public String issue(UserAccount user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("hospital-identity")
                .subject(user.getUsername())
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .claim("uid", user.getId())
                .claim("email", user.getEmail())
                .claim("roles", List.of(user.getRole().name()))
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
