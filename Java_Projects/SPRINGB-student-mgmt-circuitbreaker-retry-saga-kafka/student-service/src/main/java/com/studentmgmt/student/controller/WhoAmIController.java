package com.studentmgmt.student.controller;

import com.studentmgmt.student.security.AuthenticatedUserFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * A literal "/me" path segment always wins over "/{id}" in StudentController
 * regardless of declaration order, so this needs no existing-controller
 * changes and no new gateway route — already covered by Path=/api/students/**.
 */
@RestController
@RequestMapping("/api/students")
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
