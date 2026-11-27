package com.fooddelivery.customer.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "customer_activity", indexes = @Index(name = "idx_activity_customer_time", columnList = "customerId,createdAt"))
@Getter @Setter @NoArgsConstructor
public class CustomerActivity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, length = 40) private String type;
    @Column(length = 300) private String detail;
    @Column(nullable = false) private Instant createdAt = Instant.now();

    public CustomerActivity(Long customerId, String type, String detail) {
        this.customerId = customerId;
        this.type = type;
        this.detail = detail;
    }
}
