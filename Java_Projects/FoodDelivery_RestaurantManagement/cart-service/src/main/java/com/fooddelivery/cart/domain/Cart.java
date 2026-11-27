package com.fooddelivery.cart.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** One active cart per customer, bound to ONE restaurant (enforced in CartService). */
@Entity
@Table(name = "carts", uniqueConstraints = @UniqueConstraint(name = "uk_cart_customer", columnNames = "customerId"))
@Getter @Setter @NoArgsConstructor
public class Cart extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long customerId;
    private Long restaurantId;
    @Column(length = 40) private String couponCode;
    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id asc")
    private List<CartItem> items = new ArrayList<>();
    @Version private Long version;
}
