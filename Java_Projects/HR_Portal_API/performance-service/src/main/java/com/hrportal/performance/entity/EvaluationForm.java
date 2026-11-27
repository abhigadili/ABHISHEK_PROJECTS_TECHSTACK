package com.hrportal.performance.entity;

import org.hibernate.annotations.SQLRestriction;

import com.hrportal.common.persistence.SoftDeletableEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Configurable evaluation form: a named list of questions (ratings and free text). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "evaluation_forms")
@SQLRestriction("deleted = false")
public class EvaluationForm extends SoftDeletableEntity {
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 300)
    private String description;
    @Column(nullable = false)
    private boolean active = true;
}
