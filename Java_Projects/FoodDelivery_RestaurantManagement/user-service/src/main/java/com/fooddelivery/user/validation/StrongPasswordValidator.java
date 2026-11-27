package com.fooddelivery.user.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    @Override
    public boolean isValid(String p, ConstraintValidatorContext ctx) {
        if (p == null) return true;   // @NotBlank reports null/blank
        return p.length() >= 8 && p.length() <= 64 && p.chars().anyMatch(Character::isUpperCase)
                && p.chars().anyMatch(Character::isLowerCase) && p.chars().anyMatch(Character::isDigit)
                && p.chars().anyMatch(c -> !Character.isLetterOrDigit(c));
    }
}
