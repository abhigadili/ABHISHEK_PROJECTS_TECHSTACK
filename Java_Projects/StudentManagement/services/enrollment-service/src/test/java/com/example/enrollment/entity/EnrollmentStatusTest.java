package com.example.enrollment.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.common.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

class EnrollmentStatusTest {
    @Test
    void stateMachineAllowsOnlyDefinedTransitions() {
        assertThat(EnrollmentStatus.PENDING.allowedNext()).containsExactlyInAnyOrder(EnrollmentStatus.CONFIRMED, EnrollmentStatus.REJECTED);
        assertThat(EnrollmentStatus.CONFIRMED.allowedNext()).containsExactly(EnrollmentStatus.CANCELLED);
        assertThat(EnrollmentStatus.REJECTED.allowedNext()).isEmpty();
        assertThat(EnrollmentStatus.CANCELLED.allowedNext()).isEmpty();
    }

    @Test
    void entityRefusesIllegalTransition() {
        Enrollment e = new Enrollment();
        e.setEnrollmentId(1L);
        e.setStatus(EnrollmentStatus.REJECTED);
        assertThatThrownBy(() -> e.transitionTo(EnrollmentStatus.CONFIRMED)).isInstanceOf(BusinessRuleException.class);
        e.setStatus(EnrollmentStatus.PENDING);
        e.transitionTo(EnrollmentStatus.CONFIRMED);
        assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    }
}
