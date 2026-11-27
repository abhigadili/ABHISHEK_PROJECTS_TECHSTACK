package com.example.student.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

/** Optional phone number: 7-15 digits with optional leading '+', spaces, dashes or parentheses. */
@Documented
@Constraint(validatedBy = PhoneNumberValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPhoneNumber {
    String message() default "must be a valid phone number (7-15 digits, optional leading +)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
