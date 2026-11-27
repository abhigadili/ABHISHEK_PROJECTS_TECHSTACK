package com.fooddelivery.user.validation;

import com.fooddelivery.user.web.Dtos;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PasswordsMatchValidator implements ConstraintValidator<PasswordsMatch, Dtos.RegisterRequest> {
    @Override
    public boolean isValid(Dtos.RegisterRequest r, ConstraintValidatorContext ctx) {
        return r == null || r.password() == null || r.password().equals(r.confirmPassword());
    }
}
