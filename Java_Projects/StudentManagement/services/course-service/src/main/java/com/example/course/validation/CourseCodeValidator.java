package com.example.course.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class CourseCodeValidator implements ConstraintValidator<ValidCourseCode, String> {
    private static final Pattern CODE = Pattern.compile("^[A-Z0-9][A-Z0-9-]{1,19}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) { return value != null && CODE.matcher(value).matches(); }
}
