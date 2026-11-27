package com.hospital.billing.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The unique (referenceType, referenceId) makes bill generation from Kafka events naturally idempotent. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "bills",
        uniqueConstraints = {@UniqueConstraint(name = "uk_bill_number", columnNames = "billNumber"),
                @UniqueConstraint(name = "uk_bill_reference", columnNames = {"referenceType", "referenceId"})},
        indexes = {@Index(name = "idx_bill_patient", columnList = "patientId,createdAt"),
                @Index(name = "idx_bill_status_due", columnList = "status,dueDate")})
public class Bill {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 40)
    private String billNumber;
    @Column(nullable = false)
    private Long patientId;
    @Column(nullable = false, length = 121)
    private String patientName;
    @Column(length = 120)
    private String patientEmail;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private BillType billType;
    @Column(length = 20)
    private String referenceType;
    private Long referenceId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private BillStatus status = BillStatus.PENDING;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;
    @Column(nullable = false, length = 3)
    private String currency = "INR";
    @Column(nullable = false)
    private LocalDate dueDate;
    private Instant lastReminderAt;
    @Column(length = 255)
    private String note;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
    @Version
    private Long version;
    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BillItem> items = new ArrayList<>();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public void addItem(BillItem i) {
        i.setBill(this);
        items.add(i);
        totalAmount = totalAmount.add(i.getAmount());
    }

    public BigDecimal outstanding() {
        return totalAmount.subtract(paidAmount);
    }
}
