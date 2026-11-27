package com.fooddelivery.customer.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "addresses", indexes = @Index(name = "idx_addresses_customer", columnList = "customer_id"))
@Getter @Setter @NoArgsConstructor
public class Address {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "customer_id")
    private Customer customer;
    @Column(nullable = false, length = 40) private String label;
    @Column(nullable = false, length = 200) private String line1;
    @Column(length = 200) private String line2;
    @Column(nullable = false, length = 80) private String city;
    @Column(length = 80) private String state;
    @Column(nullable = false, length = 12) private String postalCode;
    private Double latitude;
    private Double longitude;
    @Column(name = "is_default", nullable = false) private boolean defaultAddress;
}
