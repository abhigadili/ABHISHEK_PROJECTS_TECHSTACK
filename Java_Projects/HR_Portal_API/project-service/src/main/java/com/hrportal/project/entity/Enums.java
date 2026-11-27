package com.hrportal.project.entity;

public final class Enums {
    private Enums() {
    }

    public enum ProjectStatus {
        PLANNED, ACTIVE, ON_HOLD, COMPLETED, CANCELLED;

        public boolean isClosed() {
            return this == COMPLETED || this == CANCELLED;
        }
    }

    public enum BillingModel { TIME_AND_MATERIAL, FIXED_PRICE, RETAINER, NON_BILLABLE }

    public enum CustomerStatus { ACTIVE, INACTIVE }

    public enum AllocationStatus { ACTIVE, ENDED }
}
