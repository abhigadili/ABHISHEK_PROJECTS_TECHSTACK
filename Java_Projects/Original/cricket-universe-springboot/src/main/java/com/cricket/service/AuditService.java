package com.cricket.service;

import com.cricket.entity.AuditCountry;
import com.cricket.entity.AuditCricketer;
import com.cricket.entity.AuditLeague;
import com.cricket.entity.AuditTeam;
import com.cricket.repository.AuditCountryRepository;
import com.cricket.repository.AuditCricketerRepository;
import com.cricket.repository.AuditLeagueRepository;
import com.cricket.repository.AuditTeamRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Read-only access to the four audit trail tables. Rows are written
 * exclusively by MySQL triggers whenever a country/league/team/cricketer row
 * is inserted, updated or deleted — this service never writes to them.
 */
@Service
public class AuditService {

    private final AuditCountryRepository auditCountryRepository;
    private final AuditLeagueRepository auditLeagueRepository;
    private final AuditTeamRepository auditTeamRepository;
    private final AuditCricketerRepository auditCricketerRepository;

    public AuditService(AuditCountryRepository auditCountryRepository,
                         AuditLeagueRepository auditLeagueRepository,
                         AuditTeamRepository auditTeamRepository,
                         AuditCricketerRepository auditCricketerRepository) {
        this.auditCountryRepository = auditCountryRepository;
        this.auditLeagueRepository = auditLeagueRepository;
        this.auditTeamRepository = auditTeamRepository;
        this.auditCricketerRepository = auditCricketerRepository;
    }

    public List<AuditCountry> countryAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return auditCountryRepository.findAllByOrderByChangedAtDesc();
        }
        return auditCountryRepository.findByRecordIdOrderByChangedAtDesc(recordId);
    }

    public List<AuditLeague> leagueAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return auditLeagueRepository.findAllByOrderByChangedAtDesc();
        }
        return auditLeagueRepository.findByRecordIdOrderByChangedAtDesc(recordId);
    }

    public List<AuditTeam> teamAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return auditTeamRepository.findAllByOrderByChangedAtDesc();
        }
        return auditTeamRepository.findByRecordIdOrderByChangedAtDesc(recordId);
    }

    public List<AuditCricketer> cricketerAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return auditCricketerRepository.findAllByOrderByChangedAtDesc();
        }
        return auditCricketerRepository.findByRecordIdOrderByChangedAtDesc(recordId);
    }
}
