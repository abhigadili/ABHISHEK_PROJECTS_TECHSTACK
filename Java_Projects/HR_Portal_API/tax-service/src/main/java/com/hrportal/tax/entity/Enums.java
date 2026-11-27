package com.hrportal.tax.entity;

public final class Enums {
    private Enums() {
    }

    public enum Regime { OLD, NEW }

    public enum DeclarationStatus { DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED }

    public enum InvestmentStatus { DECLARED, PROOF_SUBMITTED, VERIFIED, REJECTED }

    public enum ProofStatus { SUBMITTED, VERIFIED, REJECTED }

    public enum DocType { FORM16_PART_A, FORM16_PART_B, TAX_STATEMENT, OTHER }
}
