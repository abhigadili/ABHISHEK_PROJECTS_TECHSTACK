package com.fooddelivery.order.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "orders",
        uniqueConstraints = {@UniqueConstraint(name = "uk_orders_number", columnNames = "orderNumber"),
                @UniqueConstraint(name = "uk_orders_idempotency", columnNames = {"customerId", "idempotencyKey"})},
        indexes = {@Index(name = "idx_orders_customer_created", columnList = "customerId,createdAt"),
                @Index(name = "idx_orders_restaurant_status", columnList = "restaurantId,status"),
                @Index(name = "idx_orders_status_created", columnList = "status,createdAt")})
@Getter @Setter @NoArgsConstructor
public class CustomerOrder extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 30) private String orderNumber;
    @Column(length = 64) private String idempotencyKey;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, length = 120) private String customerName;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false, length = 120) private String restaurantName;
    @Column(nullable = false) private Long restaurantOwnerUserId;
    @Column(nullable = false, length = 300) private String pickupAddress;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) private OrderStatus status = OrderStatus.CREATED;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal subtotal;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal discountAmount = BigDecimal.ZERO;
    @Column(length = 40) private String couponCode;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal deliveryFee;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal taxAmount;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal totalAmount;
    @Embedded private DeliveryAddress deliveryAddress;
    @Column(length = 500) private String specialInstructions;
    @Column(length = 20) private String paymentMethod;
    @Column(length = 300) private String cancelReason;
    @Column(length = 40) private String cancelledBy;
    private int estimatedPrepMinutes;
    // Sets (not Lists): the detail query fetches both collections at once, and Hibernate cannot fetch two "bags" together.
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private Set<OrderItem> items = new LinkedHashSet<>();
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private Set<OrderStatusHistory> history = new LinkedHashSet<>();
    /** Optimistic lock: two simultaneous status changes cannot both win. */
    @Version private Long version;

    public void addItem(OrderItem i) { i.setOrder(this); items.add(i); }
    public void addHistory(OrderStatusHistory h) { h.setOrder(this); history.add(h); }
}
