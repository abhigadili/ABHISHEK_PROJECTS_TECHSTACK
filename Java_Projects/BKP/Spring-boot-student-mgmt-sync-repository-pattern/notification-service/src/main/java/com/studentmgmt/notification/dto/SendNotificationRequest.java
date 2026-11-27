package com.studentmgmt.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Request body for POST /api/notifications/send — the endpoint
 * enrollment-service calls synchronously after a successful payment.
 * Kept separate from the Notification entity because a send request also
 * carries the actual email/phone contact info needed to write the matching
 * Email_Logs/SMS_Logs row, which the Notifications table itself doesn't store.
 */
public class SendNotificationRequest {

    @NotNull
    private Long recipientId;

    private String recipientType = "STUDENT";

    @NotBlank
    @Pattern(regexp = "EMAIL|SMS", message = "channel must be EMAIL or SMS")
    private String channel;

    private String subject;

    @NotBlank
    private String message;

    /** Required when channel = EMAIL. */
    private String toEmail;

    /** Required when channel = SMS. */
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
