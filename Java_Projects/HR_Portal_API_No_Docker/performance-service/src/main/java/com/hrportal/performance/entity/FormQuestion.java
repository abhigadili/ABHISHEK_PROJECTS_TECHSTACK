package com.hrportal.performance.entity;

import java.math.BigDecimal;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.performance.entity.Enums.QuestionType;

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
@Table(name = "form_questions", indexes = @Index(name = "idx_question_form", columnList = "formId,orderNo"))
public class FormQuestion extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String formId;
    @Column(nullable = false, length = 80)
    private String section;
    @Column(nullable = false, length = 500)
    private String text;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private QuestionType type = QuestionType.RATING;
    /** Weight of a RATING question in the weighted average (relative). */
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal weight = BigDecimal.ONE;
    @Column(nullable = false)
    private boolean required = true;
    @Column(nullable = false)
    private int orderNo = 1;
}
