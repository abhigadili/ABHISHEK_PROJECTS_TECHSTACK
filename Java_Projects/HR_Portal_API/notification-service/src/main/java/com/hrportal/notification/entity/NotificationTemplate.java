package com.hrportal.notification.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Subject / body templates with {{placeholder}} tokens filled from the event parameters. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notification_templates", uniqueConstraints = @UniqueConstraint(name = "uk_template_code", columnNames = "code"))
public class NotificationTemplate extends BaseEntity {
    @Column(nullable = false, length = 60)
    private String code;
    @Column(nullable = false, length = 200)
    private String subjectTemplate;
    @Column(nullable = false, length = 2000)
    private String bodyTemplate;
    @Column(length = 200)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
}
