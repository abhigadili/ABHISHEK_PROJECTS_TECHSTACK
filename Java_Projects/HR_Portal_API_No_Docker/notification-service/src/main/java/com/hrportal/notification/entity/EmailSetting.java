package com.hrportal.notification.entity;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.notification.entity.Enums.EmailMode;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Configurable e-mail settings (single row). The SMTP password is NOT stored here - it comes from the SMTP_PASSWORD environment variable. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "email_settings")
public class EmailSetting extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private EmailMode mode = EmailMode.LOG;
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(length = 150)
    private String host;
    private Integer port;
    @Column(length = 150)
    private String username;
    @Column(nullable = false)
    private boolean startTls = true;
    @Column(nullable = false, length = 150)
    private String fromAddress = "no-reply@hrportal.local";
}
