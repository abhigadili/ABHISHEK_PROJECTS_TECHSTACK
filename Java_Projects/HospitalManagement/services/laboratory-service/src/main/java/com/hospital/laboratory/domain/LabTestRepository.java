package com.hospital.laboratory.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LabTestRepository extends JpaRepository<LabTest, Long> {
    Optional<LabTest> findByCode(String code);

    boolean existsByCode(String code);

    List<LabTest> findByActiveTrueOrderByName();
}
