package com.hrportal.timesheet.entity;

public final class Enums {
    private Enums() {
    }

    public enum TimesheetStatus { DRAFT, SUBMITTED, APPROVED, REJECTED }

    public enum HistoryAction { CREATED, ENTRIES_SAVED, SUBMITTED, RESUBMITTED, APPROVED, REJECTED, REOPENED }
}
