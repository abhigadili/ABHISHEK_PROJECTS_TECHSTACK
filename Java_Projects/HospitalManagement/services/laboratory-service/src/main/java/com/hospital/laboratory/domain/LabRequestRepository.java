package com.hospital.laboratory.domain;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LabRequestRepository extends JpaRepository<LabRequest, Long> {
    Page<LabRequest> findByStatus(LabStatus status, Pageable pageable);

    List<LabRequest> findByPatientIdOrderByRequestedAtDesc(Long patientId);
}
