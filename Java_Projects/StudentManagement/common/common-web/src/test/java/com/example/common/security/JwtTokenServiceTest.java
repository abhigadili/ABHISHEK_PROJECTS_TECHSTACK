package com.example.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class JwtTokenServiceTest {
    private static JwtTokenService service(String secret, Duration ttl) {
        JwtProperties p = new JwtProperties();
        p.setSecret(secret);
        p.setAccessTokenTtl(ttl);
        return new JwtTokenService(p);
    }

    private final JwtTokenService jwt = service("unit-test-secret-unit-test-secret-1234", Duration.ofMinutes(5));

    @Test
    void roundTripKeepsIdentityRolesAndStudentId() {
        String token = jwt.createAccessToken(7L, "asha", List.of("STUDENT"), 42L);
        AuthenticatedUser u = jwt.parse(token).orElseThrow();
        assertThat(u.userId()).isEqualTo(7L);
        assertThat(u.username()).isEqualTo("asha");
        assertThat(u.roles()).containsExactly("STUDENT");
        assertThat(u.studentId()).isEqualTo(42L);
        assertThat(u.isStaffOrAdmin()).isFalse();
    }

    @Test
    void serviceTokenHasServiceRole() {
        AuthenticatedUser u = jwt.parse(jwt.createServiceToken("enrollment-service")).orElseThrow();
        assertThat(u.roles()).containsExactly("SERVICE");
        assertThat(u.isStaffOrAdmin()).isTrue();
    }

    @Test
    void rejectsTamperedExpiredAndForeignTokens() {
        String token = jwt.createAccessToken(1L, "a", List.of("ADMIN"), null);
        assertThat(jwt.parse(token + "x")).isEmpty();
        assertThat(jwt.parse("not-a-jwt")).isEmpty();
        assertThat(service("another-secret-another-secret-123456", Duration.ofMinutes(5)).parse(token)).isEmpty();
        assertThat(service("unit-test-secret-unit-test-secret-1234", Duration.ofSeconds(-10))
                .parse(service("unit-test-secret-unit-test-secret-1234", Duration.ofSeconds(-10)).createAccessToken(1L, "a", List.of("ADMIN"), null))).isEmpty();
    }

    @Test
    void shortSecretIsRejectedAtStartup() {
        assertThatThrownBy(() -> service("short", Duration.ofMinutes(1))).isInstanceOf(IllegalStateException.class);
    }
}
