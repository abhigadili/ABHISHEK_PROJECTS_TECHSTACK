package com.hospital.gateway;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.authorization.ServerAccessDeniedHandler;
import org.springframework.web.server.ServerWebExchange;

import com.fasterxml.jackson.databind.ObjectMapper;

import reactor.core.publisher.Mono;

/**
 * Edge security: validates the JWT once, applies coarse role rules per route family and answers
 * 401/403 in the platform's JSON error format. Fine-grained rules stay in the owning services.
 */
@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    @Bean
    public ReactiveJwtDecoder reactiveJwtDecoder(@Value("${hospital.security.jwt.secret}") String secret) {
        return NimbusReactiveJwtDecoder.withSecretKey(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http, ObjectMapper mapper) {
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> claim = jwt.getClaimAsStringList("roles");
            return (claim == null ? List.<String>of() : claim).stream()
                    .<GrantedAuthority>map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
        });
        ReactiveJwtAuthenticationConverterAdapter converter = new ReactiveJwtAuthenticationConverterAdapter(jwtConverter);

        ServerAuthenticationEntryPoint entryPoint = (exchange, ex) ->
                write(mapper, exchange, HttpStatus.UNAUTHORIZED, "Authentication required: missing, invalid or expired token");
        ServerAccessDeniedHandler denied = (exchange, ex) ->
                write(mapper, exchange, HttpStatus.FORBIDDEN, "You do not have permission to access this resource");

        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .authorizeExchange(a -> a
                        .pathMatchers("/api/auth/login", "/api/auth/register").permitAll()
                        // internal endpoints are never reachable from outside
                        .pathMatchers("/internal/**", "/ping", "/actuator/**").denyAll()
                        .pathMatchers("/api/users/**").hasRole("ADMIN")
                        .pathMatchers("/api/pharmacy/**").hasAnyRole("ADMIN", "PHARMACIST", "DOCTOR")
                        .pathMatchers("/api/lab/**").hasAnyRole("ADMIN", "DOCTOR", "LAB_STAFF", "PATIENT")
                        .pathMatchers("/api/bills/**", "/api/payments/**").hasAnyRole("ADMIN", "BILLING_STAFF", "PATIENT")
                        .pathMatchers("/api/**").authenticated()
                        .anyExchange().denyAll())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(denied))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(denied))
                .build();
    }

    static Mono<Void> write(ObjectMapper mapper, ServerWebExchange exchange, HttpStatus status, String message) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", exchange.getRequest().getPath().value());
        try {
            DataBuffer buf = exchange.getResponse().bufferFactory().wrap(mapper.writeValueAsBytes(body));
            return exchange.getResponse().writeWith(Mono.just(buf));
        } catch (Exception e) {
            return exchange.getResponse().setComplete();
        }
    }
}
