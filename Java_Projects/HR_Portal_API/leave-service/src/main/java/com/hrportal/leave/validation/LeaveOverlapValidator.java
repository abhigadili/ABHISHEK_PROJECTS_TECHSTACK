package com.hrportal.leave.validation;

import java.util.List;

import org.springframework.stereotype.Component;

import com.hrportal.common.security.CurrentUser;
import com.hrportal.leave.dto.LeaveDtos.LeaveApplyRequest;
import com.hrportal.leave.entity.Enums.LeaveStatus;
import com.hrportal.leave.repository.LeaveRepositories.LeaveApplicationRepository;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * A Spring-managed ConstraintValidator (Spring injects the repository into validators). This is the early, friendly
 * 400; the authoritative overlap check is repeated inside the locked apply transaction (a validator alone cannot
 * prevent two simultaneous requests from both passing).
 */
@Component
public class LeaveOverlapValidator implements ConstraintValidator<NoLeaveOverlap, LeaveApplyRequest> {
    private final LeaveApplicationRepository applications;

    public LeaveOverlapValidator(LeaveApplicationRepository applications) {
        this.applications = applications;
    }

    @Override
    public boolean isValid(LeaveApplyRequest req, ConstraintValidatorContext ctx) {
        String employeeId = CurrentUser.employeeId();
        if (req == null || employeeId == null || req.fromDate() == null || req.toDate() == null || req.toDate().isBefore(req.fromDate())) return true;
        boolean overlap = applications.existsOverlap(employeeId, req.fromDate(), req.toDate(), List.of(LeaveStatus.PENDING, LeaveStatus.APPROVED), null);
        if (overlap) {
            ctx.disableDefaultConstraintViolation();
            ctx.buildConstraintViolationWithTemplate("Dates overlap an existing PENDING or APPROVED leave").addPropertyNode("fromDate").addConstraintViolation();
        }
        return !overlap;
    }
}
