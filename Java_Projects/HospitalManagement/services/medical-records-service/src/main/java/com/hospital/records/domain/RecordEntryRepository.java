package com.hospital.records.domain;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecordEntryRepository extends JpaRepository<RecordEntry, Long> {
    Page<RecordEntry> findByPatientId(Long patientId, Pageable pageable);

    Page<RecordEntry> findByPatientIdAndEntryType(Long patientId, EntryType type, Pageable pageable);

    boolean existsByEntryTypeAndReferenceTypeAndReferenceId(EntryType type, String referenceType, Long referenceId);

    long countByPatientIdAndEntryType(Long patientId, EntryType type);

    List<RecordEntry> findTop5ByPatientIdOrderByRecordedAtDesc(Long patientId);
}
