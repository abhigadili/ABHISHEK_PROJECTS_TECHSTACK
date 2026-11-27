package com.hospital.doctor.domain;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorUnavailabilityRepository extends JpaRepository<DoctorUnavailability, Long> {
    List<DoctorUnavailability> findByDoctorIdAndUnavailableDateGreaterThanEqualOrderByUnavailableDate(Long doctorId, LocalDate from);

    boolean existsByDoctorIdAndUnavailableDate(Long doctorId, LocalDate date);
}
