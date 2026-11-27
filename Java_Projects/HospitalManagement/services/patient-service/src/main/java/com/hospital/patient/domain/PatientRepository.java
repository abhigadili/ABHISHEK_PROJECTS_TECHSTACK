package com.hospital.patient.domain;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientRepository extends JpaRepository<Patient, Long> {
    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);

    boolean existsByIdentityNumber(String identityNumber);

    boolean existsByUserId(Long userId);

    Optional<Patient> findByUserId(Long userId);

    @Query("""
            select p from Patient p
            where (:q is null or lower(p.firstName) like lower(concat('%', :q, '%'))
                   or lower(p.lastName) like lower(concat('%', :q, '%'))
                   or lower(p.email) like lower(concat('%', :q, '%'))
                   or p.phone like concat('%', :q, '%'))
            """)
    Page<Patient> search(@Param("q") String q, Pageable pageable);
}
