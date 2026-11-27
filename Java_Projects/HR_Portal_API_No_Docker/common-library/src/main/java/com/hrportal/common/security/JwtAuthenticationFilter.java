package com.hrportal.common.security;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Authentication filter: Authorization: Bearer &lt;jwt&gt; -> validated, revocation-checked, converted into an
 * {@link AuthenticatedUser} principal with ROLE_* and PERM_* authorities. A missing / invalid token simply leaves
 * the context anonymous; the AuthenticationEntryPoint then answers 401 for protected URLs.
 * (Not a @Component on purpose: it is added to the security chain only, never registered as a global servlet filter.)
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final JwtDecoder decoder;
    private final TokenRevocationChecker revocation;

    public JwtAuthenticationFilter(JwtDecoder decoder, TokenRevocationChecker revocation) {
        this.decoder = decoder;
        this.revocation = revocation;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = header.substring(7).trim();
            try {
                Jwt jwt = decoder.decode(token);
                if (revocation.isRevoked(jwt.getId())) {
                    log.info("Rejected revoked token jti={}", jwt.getId());
                } else {
                    authenticate(jwt, token);
                }
            } catch (Exception e) {
                log.info("Rejected invalid bearer token: {}", e.getClass().getSimpleName());
            }
        }
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove("userId");
        }
    }

    private void authenticate(Jwt jwt, String token) {
        List<String> roleClaim = jwt.getClaimAsStringList("roles");
        List<String> permClaim = jwt.getClaimAsStringList("perms");
        Set<String> roles = new HashSet<>(roleClaim == null ? List.of() : roleClaim);
        Set<String> perms = new HashSet<>(permClaim == null ? List.of() : permClaim);
        List<GrantedAuthority> authorities = new ArrayList<>();
        roles.forEach(r -> authorities.add(new SimpleGrantedAuthority("ROLE_" + r)));
        perms.forEach(p -> authorities.add(new SimpleGrantedAuthority("PERM_" + p)));
        boolean mcp = Boolean.TRUE.equals(jwt.getClaim("mcp"));
        AuthenticatedUser user = new AuthenticatedUser(jwt.getClaimAsString("uid"), jwt.getSubject(),
                jwt.getClaimAsString("eid"), jwt.getClaimAsString("email"), roles, perms, mcp, jwt.getId(), token);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, authorities));
        MDC.put("userId", user.userId() == null ? user.username() : user.userId());
    }
}
