package com.hrportal.exit.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.LocalDate;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** Custom field constraint: the requested last working day must be in the future and at most one year ahead. */
@Documented
@Constraint(validatedBy = ValidResignationDate.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidResignationDate {
    String message() default "The last working day must be after today and within one year";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidResignationDate, LocalDate> {
        @Override
        public boolean isValid(LocalDate d, ConstraintValidatorContext ctx) {
            if (d == null) return true;
            LocalDate today = LocalDate.now();
            return d.isAfter(today) && !d.isAfter(today.plusYears(1));
        }
    }
}
