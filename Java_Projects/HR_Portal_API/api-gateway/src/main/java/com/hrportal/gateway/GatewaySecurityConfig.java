package com.hrportal.gateway;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import reactor.core.publisher.Mono;

/**
 * Gateway-level authentication and authorization (coarse rules; the services enforce the fine-grained ones again):
 * JWT validation with the shared HS256 key + revocation check in Redis, role based path rules, CORS, secure headers.
 * CSRF is off: stateless bearer-token API, no cookies.
 */
@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    @Bean
    public ReactiveJwtDecoder jwtDecoder(@Value("${hr.security.jwt.secret}") String secret, ReactiveStringRedisTemplate redis) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        SecretKey key = new SecretKeySpec(bytes, "HmacSHA256");
        ReactiveJwtDecoder base = NimbusReactiveJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        // a logged-out / revoked token (its jti is a key in Redis) is rejected at the edge; if Redis is down we fail open (the services check again)
        return token -> base.decode(token).flatMap(jwt -> redis.hasKey("hr:auth:revoked:" + jwt.getId()).onErrorReturn(false)
                .flatMap(revoked -> revoked ? Mono.<Jwt>error(new org.springframework.security.oauth2.jwt.BadJwtException("Token has been revoked")) : Mono.just(jwt)));
    }

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http, ReactiveJwtDecoder decoder, GatewayErrorHandler errors) {
        Converter<Jwt, Mono<AbstractAuthenticationToken>> converter = new ReactiveJwtAuthenticationConverterAdapter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("roles");
            List<String> perms = jwt.getClaimAsStringList("perms");
            Collection<GrantedAuthority> authorities = new ArrayList<>();
            if (roles != null) roles.forEach(r -> authorities.add(new SimpleGrantedAuthority("ROLE_" + r)));
            if (perms != null) perms.forEach(p -> authorities.add(new SimpleGrantedAuthority("PERM_" + p)));
            return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        });
        http.csrf(ServerHttpSecurity.CsrfSpec::disable)
            .cors(c -> { })
            .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
            .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
            .headers(h -> h.contentTypeOptions(c -> { }).frameOptions(f -> f.mode(org.springframework.security.web.server.header.XFrameOptionsServerHttpHeadersWriter.Mode.DENY))
                    .hsts(s -> s.includeSubdomains(true).maxAge(java.time.Duration.ofDays(365))))
            .authorizeExchange(a -> a
                .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .pathMatchers("/ping", "/docs/**", "/swagger-ui.html", "/swagger-ui/**", "/webjars/**", "/v3/api-docs/**").permitAll()
                .pathMatchers("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password").permitAll()
                .pathMatchers("/api/v1/auth/users/**", "/api/v1/auth/roles/**", "/api/v1/auth/permissions/**", "/api/v1/auth/register").hasAnyRole("HR_ADMIN", "SUPER_ADMIN")
                .pathMatchers("/api/v1/payroll/runs/**", "/api/v1/payroll/components/**", "/api/v1/payroll/structures/**", "/api/v1/payroll/config/**",
                        "/api/v1/payroll/revisions/**", "/api/v1/payroll/reports/**", "/api/v1/payroll/adjustments/**", "/api/v1/payroll/loans/**", "/api/v1/payroll/entries/**")
                    .hasAnyRole("PAYROLL_ADMIN", "FINANCE_ADMIN", "SUPER_ADMIN")
                .pathMatchers("/api/v1/reports/**").hasAnyRole("HR_ADMIN", "FINANCE_ADMIN", "PAYROLL_ADMIN", "MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN")
                .pathMatchers("/api/v1/dashboard/manager").hasAnyRole("MANAGER", "HR_ADMIN", "SUPER_ADMIN")
                .pathMatchers("/api/**").authenticated()
                .anyExchange().denyAll())
            .oauth2ResourceServer(o -> o.jwt(j -> j.jwtDecoder(decoder).jwtAuthenticationConverter(converter)).authenticationEntryPoint(errors).accessDeniedHandler(errors))
            .exceptionHandling(e -> e.authenticationEntryPoint(errors).accessDeniedHandler(errors));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(@Value("${hr.gateway.cors.allowed-origins}") List<String> origins) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(origins);
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-Id", "Accept"));
        c.setExposedHeaders(List.of("X-Correlation-Id", "X-Response-Time-Ms", "Content-Disposition"));
        c.setAllowCredentials(false);
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", c);
        return source;
    }
}
