package com.hrportal.document.entity;

public final class Enums {
    private Enums() {
    }

    public enum DocumentStatus { UPLOADED, VERIFIED, APPROVED, REJECTED }

    public enum Source { MANUAL, PAYSLIP, TAX, EXIT, LEAVE }

    public enum GranteeType { EMPLOYEE, ROLE }

    public enum AccessLevel { VIEW, DOWNLOAD }
}
