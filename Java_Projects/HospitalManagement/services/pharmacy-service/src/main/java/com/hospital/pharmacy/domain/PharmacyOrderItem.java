package com.hospital.pharmacy.domain;

import java.math.BigDecimal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pharmacy_order_items")
public class PharmacyOrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, foreignKey = @ForeignKey(name = "fk_order_item_order"))
    private PharmacyOrder order;
    @Column(nullable = false, length = 150)
    private String medicineName;
    @Column(length = 60)
    private String dosage;
    @Column(nullable = false)
    private Integer quantity;
    /** Inventory item matched by name/generic name (null while no match exists). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "medicine_id", foreignKey = @ForeignKey(name = "fk_order_item_medicine"))
    private Medicine medicine;
    @Column(precision = 10, scale = 2)
    private BigDecimal unitPrice;
}
