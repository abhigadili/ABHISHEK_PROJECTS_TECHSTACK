package com.hrportal.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.JobGrade;

public interface JobGradeRepository extends JpaRepository<JobGrade, String> {
}
