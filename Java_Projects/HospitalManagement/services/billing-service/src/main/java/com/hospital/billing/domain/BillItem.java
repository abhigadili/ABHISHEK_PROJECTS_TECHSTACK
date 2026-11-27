package com.hospital.billing.domain;

import java.math.BigDecimal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "bill_items")
public class BillItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bill_id", nullable = false, foreignKey = @ForeignKey(name = "fk_bill_item_bill"))
    private Bill bill;
    @Column(nullable = false, length = 200)
    private String description;
    @Column(nullable = false)
    private Integer quantity;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    public static BillItem of(String description, int quantity, BigDecimal unitPrice) {
        BillItem i = new BillItem();
        i.description = description;
        i.quantity = quantity;
        i.unitPrice = unitPrice;
        i.amount = unitPrice.multiply(BigDecimal.valueOf(quantity));
        return i;
    }
}
