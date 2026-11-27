package com.hrportal.organization.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hrportal.organization.entity.ReportingLine;

public interface ReportingLineRepository extends JpaRepository<ReportingLine, String> {
    Optional<ReportingLine> findFirstByEmployeeIdAndEffectiveToIsNull(String employeeId);

    List<ReportingLine> findByEmployeeIdOrderByEffectiveFromDesc(String employeeId);
}
