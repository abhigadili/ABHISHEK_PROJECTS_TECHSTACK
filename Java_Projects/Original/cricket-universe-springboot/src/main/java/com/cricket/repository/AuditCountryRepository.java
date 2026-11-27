package com.cricket.repository;

import com.cricket.entity.AuditCountry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditCountryRepository extends JpaRepository<AuditCountry, Integer> {

    List<AuditCountry> findByRecordIdOrderByChangedAtDesc(String recordId);

    List<AuditCountry> findAllByOrderByChangedAtDesc();
}
