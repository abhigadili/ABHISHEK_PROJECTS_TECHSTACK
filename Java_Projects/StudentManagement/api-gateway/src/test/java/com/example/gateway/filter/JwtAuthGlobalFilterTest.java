package com.example.gateway.filter;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

class JwtAuthGlobalFilterTest {
    @Test
    void onlyLoginRegisterRefreshLogoutAreOpenAndOnlyForPost() {
        assertThat(JwtAuthGlobalFilter.isPublic("/api/auth/login", HttpMethod.POST)).isTrue();
        assertThat(JwtAuthGlobalFilter.isPublic("/api/auth/register", HttpMethod.POST)).isTrue();
        assertThat(JwtAuthGlobalFilter.isPublic("/api/auth/refresh", HttpMethod.POST)).isTrue();
        assertThat(JwtAuthGlobalFilter.isPublic("/api/auth/login", HttpMethod.GET)).isFalse();
        assertThat(JwtAuthGlobalFilter.isPublic("/api/auth/me", HttpMethod.GET)).isFalse();
    }

    @Test
    void businessRoutesRequireAToken() {
        for (String p : new String[]{"/api/students", "/api/courses/1", "/api/enrollments", "/api/notifications/student/1"}) {
            assertThat(JwtAuthGlobalFilter.isPublic(p, HttpMethod.GET)).as(p).isFalse();
        }
    }

    @Test
    void docsHealthAndFallbackStayOpen() {
        for (String p : new String[]{"/actuator/health", "/swagger-ui/index.html", "/swagger-ui.html", "/v3/api-docs/swagger-config", "/docs/student/v3/api-docs", "/fallback/student-service"}) {
            assertThat(JwtAuthGlobalFilter.isPublic(p, HttpMethod.GET)).as(p).isTrue();
        }
    }
}
