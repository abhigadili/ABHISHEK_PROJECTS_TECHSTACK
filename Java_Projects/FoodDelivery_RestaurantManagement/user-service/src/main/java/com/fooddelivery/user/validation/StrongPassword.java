package com.fooddelivery.user.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** Custom Bean Validation annotation: 8-64 chars with upper, lower, digit and special character. */
@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Password must be 8-64 characters with upper-case, lower-case, a digit and a special character";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
