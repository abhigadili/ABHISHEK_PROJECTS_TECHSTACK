package com.cricket.repository;

import com.cricket.entity.AuditLeague;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLeagueRepository extends JpaRepository<AuditLeague, Integer> {

    List<AuditLeague> findByRecordIdOrderByChangedAtDesc(String recordId);

    List<AuditLeague> findAllByOrderByChangedAtDesc();
}
