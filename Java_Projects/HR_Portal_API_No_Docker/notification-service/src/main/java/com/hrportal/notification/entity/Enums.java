package com.hrportal.notification.entity;

public final class Enums {
    private Enums() {
    }

    public enum Channel { IN_APP, EMAIL }

    public enum DeliveryStatus { PENDING, SENT, FAILED, SKIPPED }

    public enum EmailMode { LOG, SMTP }
}
