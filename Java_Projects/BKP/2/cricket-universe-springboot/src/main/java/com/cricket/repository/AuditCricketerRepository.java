package com.cricket.repository;

import com.cricket.entity.AuditCricketer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditCricketerRepository extends JpaRepository<AuditCricketer, Integer> {

    List<AuditCricketer> findByRecordIdOrderByChangedAtDesc(String recordId);

    List<AuditCricketer> findAllByOrderByChangedAtDesc();
}
