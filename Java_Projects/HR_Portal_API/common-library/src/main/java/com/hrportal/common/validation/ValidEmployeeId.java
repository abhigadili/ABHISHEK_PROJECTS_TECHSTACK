package com.hrportal.common.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.UUID;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/** FIELD-LEVEL custom validation: the value must be a well-formed employee UUID (existence is checked by the owning service). */
@Documented
@Constraint(validatedBy = ValidEmployeeId.Validator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidEmployeeId {
    String message() default "Invalid employee id";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidEmployeeId, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext ctx) {
            if (value == null) return true;
            try {
                return UUID.fromString(value).toString().equalsIgnoreCase(value);
            } catch (IllegalArgumentException e) {
                return false;
            }
        }
    }
}
