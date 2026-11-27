package com.hrportal.exit.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.exit.entity.Enums.LineType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "settlement_lines", indexes = @Index(name = "idx_sline_settlement", columnList = "settlementId"))
public class SettlementLine extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String settlementId;
    @Column(nullable = false, length = 40)
    private String code;
    @Column(nullable = false, length = 200)
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LineType type;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
}
