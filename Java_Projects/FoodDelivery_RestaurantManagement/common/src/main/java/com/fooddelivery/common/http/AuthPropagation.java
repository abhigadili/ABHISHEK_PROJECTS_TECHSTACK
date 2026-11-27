package com.fooddelivery.common.http;

import com.fooddelivery.common.security.ServiceTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Decides which Authorization header an outgoing call carries: the caller's own token if there is one, else a service token. */
@Component
public class AuthPropagation {
    private final ServiceTokenProvider serviceTokens;

    public AuthPropagation(ServiceTokenProvider serviceTokens) { this.serviceTokens = serviceTokens; }

    public String authorizationHeader() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest req = attrs.getRequest();
            String h = req.getHeader("Authorization");
            if (h != null && h.startsWith("Bearer ")) return h;
        }
        return "Bearer " + serviceTokens.token();
    }
}
