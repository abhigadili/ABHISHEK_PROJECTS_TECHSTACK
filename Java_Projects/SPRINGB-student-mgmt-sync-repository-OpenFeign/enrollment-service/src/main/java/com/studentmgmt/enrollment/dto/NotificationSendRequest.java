package com.studentmgmt.enrollment.dto;

/**
 * Client-side mirror of notification-service's POST /api/notifications/send
 * request body. Built and sent by NotificationClient.
 */
public class NotificationSendRequest {

    private Long recipientId;
    private String recipientType = "STUDENT";
    private String channel;
    private String subject;
    private String message;
    private String toEmail;
    private String toPhone;

    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }

    public String getRecipientType() { return recipientType; }
    public void setRecipientType(String recipientType) { this.recipientType = recipientType; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getToEmail() { return toEmail; }
    public void setToEmail(String toEmail) { this.toEmail = toEmail; }

    public String getToPhone() { return toPhone; }
    public void setToPhone(String toPhone) { this.toPhone = toPhone; }
}
