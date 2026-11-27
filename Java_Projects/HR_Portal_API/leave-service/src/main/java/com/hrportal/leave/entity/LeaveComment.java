package com.hrportal.leave.entity;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "leave_comments", indexes = @Index(name = "idx_comment_application", columnList = "applicationId"))
public class LeaveComment extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String applicationId;
    @Column(length = 36)
    private String authorId;
    @Column(nullable = false, length = 1000)
    private String comment;
}
