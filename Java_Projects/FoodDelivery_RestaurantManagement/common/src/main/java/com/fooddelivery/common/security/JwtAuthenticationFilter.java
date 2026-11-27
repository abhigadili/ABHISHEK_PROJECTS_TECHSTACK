package com.fooddelivery.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Authenticates every request from the Bearer token. Each service validates the token itself:
 * the gateway check is a first line of defence, not the only one.
 */
public class JwtAuthenticationFilter extends org.springframework.web.filter.GenericFilterBean {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final JwtService jwt;
    private final RevokedTokenStore revoked;

    public JwtAuthenticationFilter(JwtService jwt, RevokedTokenStore revoked) {
        this.jwt = jwt;
        this.revoked = revoked;
    }

    /**
     * Deliberately NOT a OncePerRequestFilter: controllers returning CompletableFuture are re-dispatched asynchronously and Spring
     * Security authorises that dispatch again, so the token must be (cheaply) validated again whenever no authentication is present.
     */
    @Override
    public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        if (SecurityContextHolder.getContext().getAuthentication() == null) authenticate(req);
        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims c = jwt.parse(header.substring(7));
                String type = c.get("typ", String.class);
                if (!JwtService.TYPE_REFRESH.equals(type) && !revoked.isRevoked(c.getId())) {
                    AuthUser user = jwt.toAuthUser(c);
                    List<GrantedAuthority> auth = new ArrayList<>();
                    user.roles().forEach(r -> auth.add(new SimpleGrantedAuthority("ROLE_" + r)));
                    user.permissions().forEach(p -> auth.add(new SimpleGrantedAuthority("PERM_" + p)));
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, auth));
                    MDC.put("userId", String.valueOf(user.userId()));
                }
            } catch (JwtException | IllegalArgumentException e) {
                log.debug("Rejected bearer token: {}", e.getMessage());   // no token content is logged
            }
        }
    }
}
