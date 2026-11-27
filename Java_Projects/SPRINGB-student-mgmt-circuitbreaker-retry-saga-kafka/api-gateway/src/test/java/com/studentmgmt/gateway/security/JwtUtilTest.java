package com.studentmgmt.gateway.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil(
            "test-only-signing-secret-must-be-at-least-32-bytes-long", 60_000L);

    @Test
    void generatedTokenIsValidAndRoundTripsUsernameAndRole() {
        String token = jwtUtil.generateToken("aarav.sharma", "STUDENT");

        assertThat(jwtUtil.isValid(token)).isTrue();
        assertThat(jwtUtil.extractUsername(token)).isEqualTo("aarav.sharma");
        assertThat(jwtUtil.extractRole(token)).isEqualTo("STUDENT");
    }

    @Test
    void garbageStringIsNotValid() {
        assertThat(jwtUtil.isValid("not-a-real-jwt")).isFalse();
    }

    @Test
    void tokenSignedWithADifferentSecretIsNotValid() {
        JwtUtil otherGateway = new JwtUtil(
                "a-completely-different-signing-secret-that-is-also-long-enough", 60_000L);
        String tokenFromOtherGateway = otherGateway.generateToken("kabir.singh", "ADMIN");

        assertThat(jwtUtil.isValid(tokenFromOtherGateway)).isFalse();
    }
}
