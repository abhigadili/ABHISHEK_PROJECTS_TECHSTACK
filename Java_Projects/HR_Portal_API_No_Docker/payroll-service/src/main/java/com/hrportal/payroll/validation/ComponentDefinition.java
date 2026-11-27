package com.hrportal.payroll.validation;

/** Implemented by requests that define a salary component (type + calculation type); checked by {@link ValidSalaryComponent}. */
public interface ComponentDefinition {
    String type();

    String calcType();
}
