package com.hospital.records.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientRecordRepository extends JpaRepository<PatientRecord, Long> {
    Optional<PatientRecord> findByPatientId(Long patientId);
}
