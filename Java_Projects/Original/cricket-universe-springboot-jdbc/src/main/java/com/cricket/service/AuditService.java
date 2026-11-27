package com.cricket.service;

import com.cricket.model.AuditCountry;
import com.cricket.model.AuditCricketer;
import com.cricket.model.AuditLeague;
import com.cricket.model.AuditTeam;
import com.cricket.repository.AuditRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditService {

    private final AuditRepository auditRepository;

    public AuditService(AuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    public List<AuditCountry> countryAudit(String recordId) {
        return auditRepository.findCountryAudit(recordId);
    }

    public List<AuditLeague> leagueAudit(String recordId) {
        return auditRepository.findLeagueAudit(recordId);
    }

    public List<AuditTeam> teamAudit(String recordId) {
        return auditRepository.findTeamAudit(recordId);
    }

    public List<AuditCricketer> cricketerAudit(String recordId) {
        return auditRepository.findCricketerAudit(recordId);
    }
}
