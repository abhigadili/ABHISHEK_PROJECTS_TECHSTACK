package com.example.common.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

/** JSON 401 / 403 bodies in the same shape as {@link com.example.common.exception.ApiError}. */
public final class JsonSecurityHandlers {
    private JsonSecurityHandlers() {}

    public static AuthenticationEntryPoint entryPoint() {
        return (req, res, ex) -> write(res, 401, "Unauthorized", "Authentication required or token invalid/expired", req.getRequestURI());
    }

    public static AccessDeniedHandler accessDenied() {
        return (req, res, ex) -> write(res, 403, "Forbidden", "You do not have permission to perform this action", req.getRequestURI());
    }

    private static void write(HttpServletResponse res, int status, String error, String message, String path) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status + ",\"error\":\"" + error
                + "\",\"message\":\"" + message + "\",\"path\":\"" + path + "\"}");
    }
}
