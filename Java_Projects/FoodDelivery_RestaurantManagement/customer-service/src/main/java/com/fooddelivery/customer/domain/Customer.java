package com.fooddelivery.customer.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Customer profile. The primary key IS the user id from user-service (no separate mapping table needed). */
@Entity
@Table(name = "customers", indexes = {@Index(name = "idx_customers_status", columnList = "status"),
        @Index(name = "idx_customers_email", columnList = "email")})
@Getter @Setter @NoArgsConstructor
public class Customer extends AuditableEntity {
    public enum Status { ACTIVE, BLOCKED }

    @Id
    private Long userId;
    @Column(nullable = false, length = 120)
    private String fullName;
    @Column(length = 150)
    private String email;
    @Column(length = 20)
    private String phone;
    @Column(length = 255)
    private String avatarUrl;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
    @Embedded
    private Preferences preferences = new Preferences();
    private Instant lastActiveAt;
    // one-to-many, lazy by default; cascade + orphanRemoval so removing from the list deletes the row
    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Address> addresses = new ArrayList<>();
    @Version
    private Long version;

    public void addAddress(Address a) { a.setCustomer(this); addresses.add(a); }
}
