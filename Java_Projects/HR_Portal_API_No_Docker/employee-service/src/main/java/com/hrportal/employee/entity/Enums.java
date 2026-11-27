package com.hrportal.employee.entity;

/** Enumerations used by the employee model (stored as strings so the data stays readable in SQL). */
public final class Enums {
    private Enums() {
    }

    public enum Gender { MALE, FEMALE, OTHER, UNDISCLOSED }

    public enum MaritalStatus { SINGLE, MARRIED, DIVORCED, WIDOWED }

    public enum EmploymentType { FULL_TIME, PART_TIME, CONTRACT, INTERN }

    public enum EmployeeStatus {
        ACTIVE, INACTIVE, ON_NOTICE, RESIGNED, TERMINATED;

        public boolean isLeft() {
            return this == RESIGNED || this == TERMINATED;
        }
    }

    public enum AddressType { CURRENT, PERMANENT, OFFICE, MAILING }

    public enum ChangeType { JOINED, PROMOTION, TRANSFER, MANAGER_CHANGE, STATUS_CHANGE, DETAILS_UPDATE }
}
