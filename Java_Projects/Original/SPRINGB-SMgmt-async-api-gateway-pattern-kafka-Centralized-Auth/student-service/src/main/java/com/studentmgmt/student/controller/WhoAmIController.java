package com.studentmgmt.student.controller;

import com.studentmgmt.student.security.AuthenticatedUserFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * A literal "/me" path segment always wins over the "/{id}" path-variable
 * mapping in StudentController regardless of declaration order — Spring MVC
 * ranks literal segments as more specific — so this needs no changes to any
 * existing controller and no new API Gateway route: it's already covered by
 * the existing Path=/api/students/** predicate.
 */
@RestController
@RequestMapping("/api/students")
public class WhoAmIController {

    @GetMapping("/me")
    public Map<String, String> whoAmI(HttpServletRequest request) {
        String authenticatedUser = (String) request.getAttribute(AuthenticatedUserFilter.ATTRIBUTE_NAME);
        return Map.of("authenticatedUser", authenticatedUser != null ? authenticatedUser : "anonymous");
    }
}
