package com.fooddelivery.delivery.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Primary key = the user id of the DELIVERY_PARTNER account. */
@Entity
@Table(name = "delivery_partners", indexes = @Index(name = "idx_partner_availability", columnList = "online,busy,suspended"))
@Getter @Setter @NoArgsConstructor
public class DeliveryPartner extends AuditableEntity {
    @Id private Long userId;
    @Column(nullable = false, length = 120) private String fullName;
    @Column(length = 20) private String phone;
    @Column(length = 20) private String vehicleType;
    @Column(length = 20) private String vehicleNumber;
    @Column(nullable = false) private boolean online;
    @Column(nullable = false) private boolean busy;
    @Column(nullable = false) private boolean suspended;
    private Double lastLatitude;
    private Double lastLongitude;
    @Column(nullable = false, precision = 3, scale = 2) private BigDecimal ratingAvg = BigDecimal.ZERO;
    @Column(nullable = false) private long ratingCount;
    @Column(nullable = false) private int completedDeliveries;
    @Column(nullable = false) private int rejectedOffers;
    private Instant lastAssignedAt;
    @Version private Long version;
}
