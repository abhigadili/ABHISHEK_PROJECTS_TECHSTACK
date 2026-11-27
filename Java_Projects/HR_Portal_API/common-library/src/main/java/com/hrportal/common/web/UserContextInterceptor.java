package com.hrportal.common.web;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.hrportal.common.exception.ApiException;
import com.hrportal.common.security.CurrentUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * HandlerInterceptor #2: copies the authenticated identity into the request context and enforces a business
 * rule that belongs to the request pipeline - a user flagged "must change password" may only call the
 * change-password / logout / me endpoints until the password is changed.
 */
@Component
public class UserContextInterceptor implements HandlerInterceptor {
    private final ObjectProvider<RequestContext> context;

    public UserContextInterceptor(ObjectProvider<RequestContext> context) {
        this.context = context;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        CurrentUser.get().ifPresent(u -> {
            RequestContext ctx = context.getObject();
            ctx.setUserId(u.userId());
            ctx.setEmployeeId(u.employeeId());
            ctx.setUsername(u.username());
            if (u.mustChangePassword() && !isPasswordFlow(req.getRequestURI())) {
                throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "PASSWORD_CHANGE_REQUIRED",
                        "Password change required before using the portal") {
                };
            }
        });
        return true;
    }

    private static boolean isPasswordFlow(String uri) {
        return uri.equals("/api/v1/auth/change-password") || uri.equals("/api/v1/auth/logout") || uri.equals("/api/v1/auth/me");
    }
}
