package com.hospital.laboratory.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LabReportRepository extends JpaRepository<LabReport, Long> {
    Optional<LabReport> findByRequestId(Long requestId);

    boolean existsByRequestId(Long requestId);
}
