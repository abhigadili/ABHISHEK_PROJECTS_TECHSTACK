package com.studentmgmt.notification.model;

import java.time.LocalDateTime;

public class SmsLog {

    private Long smsLogId;
    private Long notificationId;
    private String toPhone;
    private String message;
    private String status;
    private LocalDateTime sentAt;
    private String errorMessage;

    public Long getSmsLogId() {
        return smsLogId;
    }

    public void setSmsLogId(Long smsLogId) {
        this.smsLogId = smsLogId;
    }

    public Long getNotificationId() {
        return notificationId;
    }

    public void setNotificationId(Long notificationId) {
        this.notificationId = notificationId;
    }

    public String getToPhone() {
        return toPhone;
    }

    public void setToPhone(String toPhone) {
        this.toPhone = toPhone;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getSentAt() {
        return sentAt;
    }

    public void setSentAt(LocalDateTime sentAt) {
        this.sentAt = sentAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
