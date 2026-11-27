package com.fooddelivery.admin.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Platform settings editable by admins (stored in the admin database; this is the genuine reason admin-service has one). */
@Entity
@Table(name = "system_config")
@Getter @Setter @NoArgsConstructor
public class SystemConfig {
    @Id @Column(name = "config_key", length = 80) private String key;
    @Column(name = "config_value", nullable = false, length = 500) private String value;
    @Column(length = 200) private String description;
    @Column(length = 100) private String updatedBy;
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @Version private Long version;
}
