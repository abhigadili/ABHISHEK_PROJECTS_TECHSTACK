package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.security.AuthenticatedUserFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/enrollments")
public class WhoAmIController {

    @GetMapping("/me")
    public Map<String, String> whoAmI(HttpServletRequest request) {
        String authenticatedUser = (String) request.getAttribute(AuthenticatedUserFilter.USER_ATTRIBUTE);
        String role = (String) request.getAttribute(AuthenticatedUserFilter.ROLE_ATTRIBUTE);
        return Map.of(
                "authenticatedUser", authenticatedUser != null ? authenticatedUser : "anonymous",
                "role", role != null ? role : "none");
    }
}
