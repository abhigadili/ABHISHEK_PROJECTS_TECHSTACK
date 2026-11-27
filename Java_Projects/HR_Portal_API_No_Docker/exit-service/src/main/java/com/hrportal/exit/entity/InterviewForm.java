package com.hrportal.exit.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Exit-interview form: the questions are a JSON array [{"id":"q1","text":"...","type":"RATING|TEXT"}]. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "exit_interview_forms")
public class InterviewForm extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, columnDefinition = "json")
    private String questions;
    @Column(nullable = false)
    private boolean active = true;
}
