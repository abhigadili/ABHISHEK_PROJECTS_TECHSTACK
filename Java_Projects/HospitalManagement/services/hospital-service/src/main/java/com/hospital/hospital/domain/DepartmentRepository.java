package com.hospital.hospital.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findByHospitalIdOrderByName(Long hospitalId);

    boolean existsByHospitalIdAndNameIgnoreCase(Long hospitalId, String name);
}
