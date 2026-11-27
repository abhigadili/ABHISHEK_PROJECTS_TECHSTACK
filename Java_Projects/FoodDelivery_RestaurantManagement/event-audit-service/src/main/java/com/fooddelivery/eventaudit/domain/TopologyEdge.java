package com.fooddelivery.eventaudit.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A producer->topic or topic->consumer relation announced by a running service (read from the code via reflection, not hard-coded). */
@Entity
@Table(name = "topology_edges", uniqueConstraints = @UniqueConstraint(name = "uk_topology", columnNames = {"service", "role", "topic", "className"}),
        indexes = @Index(name = "idx_topology_topic", columnList = "topic"))
@Getter @Setter @NoArgsConstructor
public class TopologyEdge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 60) private String service;
    @Column(nullable = false, length = 10) private String role;
    @Column(nullable = false, length = 100) private String topic;
    @Column(length = 100) private String groupId;
    @Column(nullable = false, length = 100) private String className;
    @Column(length = 100) private String method;
    @Column(nullable = false) private Instant lastSeen = Instant.now();
}
