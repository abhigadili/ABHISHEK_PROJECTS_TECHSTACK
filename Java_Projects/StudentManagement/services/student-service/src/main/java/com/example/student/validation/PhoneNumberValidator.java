package com.example.student.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.regex.Pattern;

public class PhoneNumberValidator implements ConstraintValidator<ValidPhoneNumber, String> {
    private static final Pattern ALLOWED = Pattern.compile("^\\+?[0-9 ()\\-]{7,20}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        if (value == null || value.isBlank()) return true; // optional
        if (!ALLOWED.matcher(value).matches()) return false;
        long digits = value.chars().filter(Character::isDigit).count();
        return digits >= 7 && digits <= 15;
    }
}
