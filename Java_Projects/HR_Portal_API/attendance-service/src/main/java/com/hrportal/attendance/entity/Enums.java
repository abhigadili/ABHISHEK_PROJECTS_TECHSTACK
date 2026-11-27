package com.hrportal.attendance.entity;

public final class Enums {
    private Enums() {
    }

    public enum AttendanceStatus { PRESENT, HALF_DAY, ABSENT, MISSING_PUNCH }

    public enum WorkMode { OFFICE, WFH }

    public enum RequestStatus { PENDING, APPROVED, REJECTED, CANCELLED }

    public enum Source { WEB, CORRECTION, IMPORT, SYSTEM }
}
