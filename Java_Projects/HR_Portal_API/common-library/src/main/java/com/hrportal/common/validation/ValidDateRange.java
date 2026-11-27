package com.hrportal.common.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** CLASS-LEVEL custom validation: start date must not be after end date (leave range, timesheet range ...). */
@Documented
@Constraint(validatedBy = ValidDateRange.Validator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidDateRange {
    String message() default "End date must be on or after the start date";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidDateRange, DateRangeAware> {
        @Override
        public boolean isValid(DateRangeAware value, ConstraintValidatorContext ctx) {
            if (value == null || value.rangeStart() == null || value.rangeEnd() == null) return true;
            return !value.rangeEnd().isBefore(value.rangeStart());
        }
    }
}
