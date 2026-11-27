package com.fooddelivery.admin.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Platform activity feed, built from business events and admin actions. */
@Entity
@Table(name = "activity_feed", indexes = @Index(name = "idx_activity_time", columnList = "occurredAt"))
@Getter @Setter @NoArgsConstructor
public class ActivityEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 40) private String category;
    @Column(nullable = false, length = 300) private String message;
    @Column(length = 100) private String actor;
    @Column(nullable = false) private Instant occurredAt = Instant.now();

    public ActivityEntry(String category, String message, String actor) {
        this.category = category;
        this.message = message;
        this.actor = actor;
    }
}
