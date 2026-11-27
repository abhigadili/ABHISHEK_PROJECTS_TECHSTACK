package com.hrportal.performance.entity;

public final class Enums {
    private Enums() {
    }

    public enum CycleStatus { DRAFT, ACTIVE, CLOSED }

    public enum CycleType { ANNUAL, HALF_YEARLY, QUARTERLY, PROBATION }

    /** Review stages: SELF_PENDING -> SELF_SUBMITTED -> MANAGER_SUBMITTED (waiting for HR) -> APPROVED. */
    public enum ReviewStatus { SELF_PENDING, SELF_SUBMITTED, MANAGER_SUBMITTED, APPROVED }

    public enum QuestionType { RATING, TEXT }

    public enum Respondent { SELF, MANAGER }

    public enum GoalType { GOAL, OKR }

    public enum GoalStatus { NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED }

    public enum FeedbackType { MANAGER, PEER }
}
