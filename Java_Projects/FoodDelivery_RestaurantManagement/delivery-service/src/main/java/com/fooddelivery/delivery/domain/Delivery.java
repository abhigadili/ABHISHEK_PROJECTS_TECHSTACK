package com.fooddelivery.delivery.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "deliveries", uniqueConstraints = @UniqueConstraint(name = "uk_delivery_order", columnNames = "orderId"),
        indexes = {@Index(name = "idx_delivery_status", columnList = "status,assignmentExpiresAt"), @Index(name = "idx_delivery_partner", columnList = "partnerUserId,status")})
@Getter @Setter @NoArgsConstructor
public class Delivery extends AuditableEntity {
    public enum Status { UNASSIGNED, ASSIGNED, ACCEPTED, PICKED_UP, DELIVERED, CANCELLED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long orderId;
    @Column(nullable = false, length = 30) private String orderNumber;
    @Column(nullable = false) private Long customerId;
    @Column(length = 120) private String customerName;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false, length = 300) private String pickupAddress;
    @Column(nullable = false, length = 300) private String deliveryAddress;
    @Column(length = 80) private String deliveryCity;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 12) private Status status = Status.UNASSIGNED;
    private Long partnerUserId;
    private Instant assignedAt;
    private Instant acceptedAt;
    private Instant pickedUpAt;
    private Instant deliveredAt;
    private Instant assignmentExpiresAt;
    @Column(nullable = false) private int offerCount;
    /** Partners who rejected or let the offer expire (comma separated user ids): they are not offered this delivery again. */
    @Column(length = 400) private String excludedPartners = "";
    @Version private Long version;

    public boolean isExcluded(long partnerId) {
        for (String s : excludedPartners.split(",")) if (s.equals(String.valueOf(partnerId))) return true;
        return false;
    }
    public void exclude(long partnerId) { excludedPartners = excludedPartners.isEmpty() ? String.valueOf(partnerId) : excludedPartners + "," + partnerId; }
}
