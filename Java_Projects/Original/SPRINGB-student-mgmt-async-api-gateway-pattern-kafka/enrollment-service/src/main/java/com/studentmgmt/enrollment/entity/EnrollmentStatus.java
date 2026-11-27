package com.studentmgmt.enrollment.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

@Entity
@Table(name = "Enrollment_Status")
public class EnrollmentStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "status_id")
    private Long statusId;

    @NotBlank
    @Column(name = "status_name", length = 30, nullable = false, unique = true)
    private String statusName;

    @Column(name = "description", length = 255)
    private String description;

    public EnrollmentStatus() {}

    public Long getStatusId() { return statusId; }
    public void setStatusId(Long statusId) { this.statusId = statusId; }

    public String getStatusName() { return statusName; }
    public void setStatusName(String statusName) { this.statusName = statusName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
