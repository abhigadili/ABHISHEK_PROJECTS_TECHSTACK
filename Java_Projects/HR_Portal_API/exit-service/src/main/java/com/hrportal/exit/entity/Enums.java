package com.hrportal.exit.entity;

public final class Enums {
    private Enums() {
    }

    /** Resignation workflow: SUBMITTED -> MANAGER_APPROVED -> HR_CONFIRMED -> CLEARED -> INTERVIEW_DONE -> SETTLEMENT_PENDING -> COMPLETED. */
    public enum ResignationStatus { SUBMITTED, MANAGER_APPROVED, MANAGER_REJECTED, HR_CONFIRMED, CLEARED, INTERVIEW_DONE, SETTLEMENT_PENDING, COMPLETED, WITHDRAWN }

    public enum TaskStatus { PENDING, DONE }

    public enum InterviewStatus { SCHEDULED, COMPLETED }

    public enum SettlementStatus { CALCULATED, PAID }

    public enum LineType { EARNING, DEDUCTION }
}
