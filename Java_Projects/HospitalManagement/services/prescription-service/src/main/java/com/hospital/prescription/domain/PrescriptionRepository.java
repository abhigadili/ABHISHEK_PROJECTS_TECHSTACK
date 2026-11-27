package com.hospital.prescription.domain;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    @Query("select distinct p from Prescription p left join fetch p.items where p.id = :id")
    java.util.Optional<Prescription> findWithItems(@Param("id") Long id);

    @Query("select distinct p from Prescription p left join fetch p.items where p.patientId = :patientId order by p.issuedAt desc")
    List<Prescription> findByPatient(@Param("patientId") Long patientId);

    @Query("select distinct p from Prescription p left join fetch p.items where p.doctorId = :doctorId order by p.issuedAt desc")
    List<Prescription> findByDoctor(@Param("doctorId") Long doctorId);

    List<Prescription> findByStatusAndValidUntilBefore(PrescriptionStatus status, LocalDate date);
}
