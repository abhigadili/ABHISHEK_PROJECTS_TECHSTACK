package com.studentmgmt.course.controller;

import com.studentmgmt.course.security.AuthenticatedUserFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * A literal "/me" path segment always wins over "/{id}" in CourseController
 * regardless of declaration order, so this needs no existing-controller
 * changes and no new gateway route — already covered by Path=/api/courses/**.
 */
@RestController
@RequestMapping("/api/courses")
public class WhoAmIController {

    @GetMapping("/me")
    public Map<String, String> whoAmI(HttpServletRequest request) {
        String authenticatedUser = (String) request.getAttribute(AuthenticatedUserFilter.ATTRIBUTE_NAME);
        return Map.of("authenticatedUser", authenticatedUser != null ? authenticatedUser : "anonymous");
    }
}
