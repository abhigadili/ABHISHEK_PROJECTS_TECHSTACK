package com.fooddelivery.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A saved payment method. Only a provider TOKEN and a masked display value are stored:
 * never a card number, CVV or UPI PIN.
 */
@Entity
@Table(name = "saved_payment_methods", indexes = @Index(name = "idx_saved_customer", columnList = "customerId"))
@Getter @Setter @NoArgsConstructor
public class SavedMethod {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long customerId;
    @Column(nullable = false, length = 20) private String type;
    @Column(nullable = false, length = 60) private String label;
    @Column(nullable = false, length = 40) private String maskedValue;
    @Column(nullable = false, length = 80) private String providerToken;
    @Column(name = "is_default", nullable = false) private boolean defaultMethod;
}
