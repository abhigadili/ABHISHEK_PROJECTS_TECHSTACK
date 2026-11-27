package com.studentmgmt.notification.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

@Entity
@Table(name = "SMS_Logs")
public class SmsLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sms_log_id")
    private Long smsLogId;

    @NotNull
    @Column(name = "notification_id", nullable = false)
    private Long notificationId;

    @NotBlank
    @Column(name = "to_phone", length = 20, nullable = false)
    private String toPhone;

    @Column(name = "message", length = 255)
    private String message;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "error_message", length = 255)
    private String errorMessage;

    public SmsLog() {}

    public Long getSmsLogId() { return smsLogId; }
    public void setSmsLogId(Long smsLogId) { this.smsLogId = smsLogId; }

    public Long getNotificationId() { return notificationId; }
    public void setNotificationId(Long notificationId) { this.notificationId = notificationId; }

    public String getToPhone() { return toPhone; }
    public void setToPhone(String toPhone) { this.toPhone = toPhone; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
