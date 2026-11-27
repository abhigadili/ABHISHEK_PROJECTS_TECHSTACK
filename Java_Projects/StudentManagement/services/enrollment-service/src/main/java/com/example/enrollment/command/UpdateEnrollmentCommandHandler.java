package com.example.enrollment.command;

import com.example.common.exception.ResourceNotFoundException;
import com.example.enrollment.dto.EnrollmentResponse;
import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.repository.EnrollmentRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Status changes are owned by the saga / cancel command (see EnrollmentStatus state machine); staff can only annotate. */
@Component
public class UpdateEnrollmentCommandHandler {
    private final EnrollmentRepository enrollments;

    public UpdateEnrollmentCommandHandler(EnrollmentRepository enrollments) { this.enrollments = enrollments; }

    @Transactional
    public EnrollmentResponse handle(UpdateEnrollmentCommand cmd) {
        Enrollment e = enrollments.findById(cmd.enrollmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment " + cmd.enrollmentId() + " not found"));
        e.setRemarks(cmd.remarks());
        return EnrollmentResponse.from(enrollments.saveAndFlush(e));
    }
}
