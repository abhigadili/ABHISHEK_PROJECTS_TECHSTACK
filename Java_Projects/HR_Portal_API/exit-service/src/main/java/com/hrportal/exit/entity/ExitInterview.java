package com.hrportal.exit.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;
import com.hrportal.exit.entity.Enums.InterviewStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "exit_interviews", uniqueConstraints = @UniqueConstraint(name = "uk_interview_resignation", columnNames = "resignationId"))
public class ExitInterview extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String resignationId;
    @Column(nullable = false, length = 36)
    private String formId;
    private Instant scheduledAt;
    @Column(length = 100)
    private String conductedBy;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private InterviewStatus status = InterviewStatus.SCHEDULED;
    /** JSON object questionId -> answer (rating or text). */
    @Column(columnDefinition = "json")
    private String answers;
    @Column(length = 2000)
    private String feedbackSummary;
    private Boolean wouldRecommend;
    private Instant completedAt;
}
