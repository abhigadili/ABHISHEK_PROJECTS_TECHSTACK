package com.hrportal.payroll.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.Set;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * Class-level custom validation for salary-component definitions: deduction-only calculation types (PF, professional tax, TDS)
 * cannot be used by an EARNING component and earning-only types (balance, % of CTC, % of basic) cannot be used by a DEDUCTION.
 */
@Documented
@Constraint(validatedBy = ValidSalaryComponent.Validator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidSalaryComponent {
    String message() default "This calculation type cannot be used with the chosen component type";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidSalaryComponent, ComponentDefinition> {
        private static final Set<String> DEDUCTION_ONLY = Set.of("STATUTORY_PF", "SLAB_PT", "TAX_TDS");
        private static final Set<String> EARNING_ONLY = Set.of("BALANCE", "PERCENT_OF_CTC", "PERCENT_OF_BASIC");

        @Override
        public boolean isValid(ComponentDefinition c, ConstraintValidatorContext ctx) {
            if (c == null || c.type() == null || c.calcType() == null) return true;
            boolean ok = "EARNING".equals(c.type()) ? !DEDUCTION_ONLY.contains(c.calcType()) : !EARNING_ONLY.contains(c.calcType());
            if (!ok) {
                ctx.disableDefaultConstraintViolation();
                ctx.buildConstraintViolationWithTemplate("calcType " + c.calcType() + " cannot be used by a " + c.type() + " component").addPropertyNode("calcType").addConstraintViolation();
            }
            return ok;
        }
    }
}
