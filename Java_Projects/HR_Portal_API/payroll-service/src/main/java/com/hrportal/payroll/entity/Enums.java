package com.hrportal.payroll.entity;

public final class Enums {
    private Enums() {
    }

    public enum ComponentType { EARNING, DEDUCTION }

    /** How a component amount is derived (each value has a matching strategy in the calculation engine). */
    public enum CalcType { FIXED, PERCENT_OF_CTC, PERCENT_OF_BASIC, BALANCE, STATUTORY_PF, SLAB_PT, TAX_TDS, VARIABLE }

    public enum SalaryStatus { ACTIVE, SUPERSEDED }

    public enum RevisionStatus { PENDING, APPROVED, REJECTED }

    public enum RunStatus { DRAFT, PROCESSED, APPROVED, FINALIZED }

    public enum AdjustmentType { BONUS, ARREARS, REIMBURSEMENT, ALLOWANCE, OTHER_DEDUCTION, FINAL_SETTLEMENT }

    public enum AdjustmentStatus { PENDING, APPLIED, CANCELLED }

    public enum LoanStatus { ACTIVE, CLOSED }
}
