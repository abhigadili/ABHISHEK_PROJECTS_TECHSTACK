package com.hrportal.timesheet.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.DayOfWeek;
import java.time.LocalDate;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** Custom field constraint (timesheet date range): a week start must be a Monday, at most 12 weeks old and not after the current week. */
@Documented
@Constraint(validatedBy = ValidTimesheetWeek.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTimesheetWeek {
    String message() default "weekStart must be a Monday within the last 12 weeks and not in the future";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidTimesheetWeek, LocalDate> {
        @Override
        public boolean isValid(LocalDate d, ConstraintValidatorContext ctx) {
            if (d == null) return true;
            LocalDate thisMonday = LocalDate.now().with(DayOfWeek.MONDAY);
            return d.getDayOfWeek() == DayOfWeek.MONDAY && !d.isAfter(thisMonday) && !d.isBefore(thisMonday.minusWeeks(12));
        }
    }
}
