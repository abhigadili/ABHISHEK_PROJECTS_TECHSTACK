package com.studentmgmt.gateway.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthorizationPolicyTest {

    private final AuthorizationPolicy policy = new AuthorizationPolicy();

    @Test
    void anyAuthenticatedRoleCanReadStudents() {
        assertThat(policy.isAllowed("GET", "/api/students/1", "STUDENT")).isTrue();
        assertThat(policy.isAllowed("GET", "/api/students/1", "ADMIN")).isTrue();
    }

    @Test
    void onlyAdminCanCreateStudents() {
        assertThat(policy.isAllowed("POST", "/api/students", "ADMIN")).isTrue();
        assertThat(policy.isAllowed("POST", "/api/students", "STUDENT")).isFalse();
    }

    @Test
    void onlyAdminCanDeleteCourses() {
        assertThat(policy.isAllowed("DELETE", "/api/courses/3", "ADMIN")).isTrue();
        assertThat(policy.isAllowed("DELETE", "/api/courses/3", "STUDENT")).isFalse();
    }

    @Test
    void studentsCanCreateTheirOwnEnrollments() {
        assertThat(policy.isAllowed("POST", "/api/enrollments", "STUDENT")).isTrue();
        assertThat(policy.isAllowed("POST", "/api/enrollments", "ADMIN")).isTrue();
    }

    @Test
    void onlyAdminCanModifyOrCancelAnEnrollmentDirectly() {
        assertThat(policy.isAllowed("PUT", "/api/enrollments/1", "STUDENT")).isFalse();
        assertThat(policy.isAllowed("DELETE", "/api/enrollments/1", "STUDENT")).isFalse();
        assertThat(policy.isAllowed("PUT", "/api/enrollments/1", "ADMIN")).isTrue();
    }

    @Test
    void onlyAdminCanToggleTheNotificationGatewaySimulation() {
        assertThat(policy.isAllowed("POST", "/api/notifications/admin/toggle-failure", "STUDENT")).isFalse();
        assertThat(policy.isAllowed("POST", "/api/notifications/admin/toggle-failure", "ADMIN")).isTrue();
    }
}
