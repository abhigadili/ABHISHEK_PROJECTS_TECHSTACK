package com.hrportal.project.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.math.BigDecimal;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** Custom field constraint: an allocation is a percentage in (0, 100] with at most two decimals and a 5 % step. */
@Documented
@Constraint(validatedBy = AllocationPercent.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface AllocationPercent {
    String message() default "Allocation must be between 5 and 100 percent in steps of 5";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<AllocationPercent, BigDecimal> {
        @Override
        public boolean isValid(BigDecimal v, ConstraintValidatorContext ctx) {
            if (v == null) return true;
            return v.compareTo(BigDecimal.valueOf(5)) >= 0 && v.compareTo(BigDecimal.valueOf(100)) <= 0
                    && v.remainder(BigDecimal.valueOf(5)).compareTo(BigDecimal.ZERO) == 0;
        }
    }
}
