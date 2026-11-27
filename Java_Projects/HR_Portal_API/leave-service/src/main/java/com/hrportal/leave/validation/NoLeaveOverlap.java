package com.hrportal.leave.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/** Class-level custom constraint: the requested range must not overlap a PENDING / APPROVED leave of the caller. */
@Documented
@Constraint(validatedBy = LeaveOverlapValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface NoLeaveOverlap {
    String message() default "The requested dates overlap an existing leave application";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
