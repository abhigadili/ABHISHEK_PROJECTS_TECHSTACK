package com.fooddelivery.delivery.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Assignment tracking: every offer and what became of it. */
@Entity
@Table(name = "assignment_log", indexes = @Index(name = "idx_assignment_delivery", columnList = "deliveryId"))
@Getter @Setter @NoArgsConstructor
public class AssignmentLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long deliveryId;
    private Long partnerUserId;
    @Column(nullable = false, length = 16) private String action;
    @Column(length = 200) private String note;
    @Column(nullable = false) private Instant at = Instant.now();

    public AssignmentLog(Long deliveryId, Long partnerUserId, String action, String note) {
        this.deliveryId = deliveryId;
        this.partnerUserId = partnerUserId;
        this.action = action;
        this.note = note;
    }
}
