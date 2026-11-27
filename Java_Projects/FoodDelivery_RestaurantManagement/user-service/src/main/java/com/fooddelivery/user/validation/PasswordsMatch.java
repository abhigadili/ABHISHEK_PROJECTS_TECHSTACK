package com.fooddelivery.user.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** Cross-field (class-level) validation: password must equal confirmPassword. */
@Documented
@Constraint(validatedBy = PasswordsMatchValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordsMatch {
    String message() default "Password and confirmPassword do not match";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
