package com.hrportal.leave.entity;

public final class Enums {
    private Enums() {
    }

    public enum LeaveStatus { PENDING, APPROVED, REJECTED, CANCELLED, WITHDRAWN }

    /** Which approval step the application is waiting for. */
    public enum ApprovalStage { MANAGER, HR, COMPLETE }

    public enum ApprovalAction { SUBMITTED, UPDATED, MANAGER_APPROVED, HR_APPROVED, REJECTED, WITHDRAWN, CANCEL_REQUESTED, CANCEL_APPROVED, CANCEL_REJECTED }
}
