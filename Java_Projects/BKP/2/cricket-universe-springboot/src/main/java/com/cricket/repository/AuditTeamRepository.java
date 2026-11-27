package com.cricket.repository;

import com.cricket.entity.AuditTeam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditTeamRepository extends JpaRepository<AuditTeam, Integer> {

    List<AuditTeam> findByRecordIdOrderByChangedAtDesc(String recordId);

    List<AuditTeam> findAllByOrderByChangedAtDesc();
}
