package com.example.course.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

/** Course code must be upper-case alphanumerics/dashes (e.g. CS-101). */
@Documented
@Constraint(validatedBy = CourseCodeValidator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidCourseCode {
    String message() default "must be upper-case letters, digits or '-' (2-20 chars), e.g. CS-101";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
