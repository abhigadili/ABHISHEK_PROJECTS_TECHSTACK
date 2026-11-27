package com.fooddelivery.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.web.ApiError;
import com.fooddelivery.common.web.Correlation;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/**
 * Shared Spring Security setup: stateless JWT bearer authentication, JSON 401/403 bodies, method-level security
 * ({@code @PreAuthorize}). CSRF is disabled on purpose: there is no cookie/session authentication, so there is
 * nothing for a cross-site request to ride on. CORS is handled once, at the API gateway.
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties({JwtProperties.class, SecurityConfig.PublicPaths.class})
public class SecurityConfig {

    /** Extra anonymous paths for a service (e.g. {@code /api/auth/**}); bound from {@code food.security.*}. */
    @ConfigurationProperties(prefix = "food.security")
    public record PublicPaths(List<String> publicPaths, List<String> publicGetPaths) {
        public PublicPaths {
            if (publicPaths == null) publicPaths = List.of();
            if (publicGetPaths == null) publicGetPaths = List.of();
        }
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwt, RevokedTokenStore revoked,
                                           PublicPaths paths, ObjectMapper mapper) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> {
                a.requestMatchers("/actuator/health/**", "/actuator/info", "/v3/api-docs/**", "/swagger-ui/**",
                        "/swagger-ui.html", "/servlet/**", "/error").permitAll();
                a.requestMatchers(HttpMethod.GET, "/api/files/**").permitAll();
                if (!paths.publicPaths().isEmpty()) a.requestMatchers(paths.publicPaths().toArray(String[]::new)).permitAll();
                if (!paths.publicGetPaths().isEmpty()) a.requestMatchers(HttpMethod.GET, paths.publicGetPaths().toArray(String[]::new)).permitAll();
                a.anyRequest().authenticated();
            })
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> write(mapper, res, req.getRequestURI(), HttpStatus.UNAUTHORIZED,
                        "UNAUTHENTICATED", "Authentication required or token invalid"))
                .accessDeniedHandler((req, res, ex) -> write(mapper, res, req.getRequestURI(), HttpStatus.FORBIDDEN,
                        "FORBIDDEN", "You do not have permission for this operation")))
            .addFilterBefore(new JwtAuthenticationFilter(jwt, revoked), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private void write(ObjectMapper mapper, HttpServletResponse res, String path, HttpStatus status, String code, String msg) throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getWriter(), new ApiError(Instant.now(), status.value(), status.getReasonPhrase(), code, msg,
                path, Correlation.current(), null));
    }
}
