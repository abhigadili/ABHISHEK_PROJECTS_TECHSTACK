package com.cricket.controller;

import com.cricket.model.AuditCountry;
import com.cricket.model.AuditCricketer;
import com.cricket.model.AuditLeague;
import com.cricket.model.AuditTeam;
import com.cricket.service.AuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only trail of every INSERT/UPDATE/DELETE against the four core tables,
 * captured by MySQL triggers into audit_countries/audit_leagues/audit_teams/audit_cricketers.
 */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/countries")
    public List<AuditCountry> countries(@RequestParam(required = false) String recordId) {
        return auditService.countryAudit(recordId);
    }

    @GetMapping("/leagues")
    public List<AuditLeague> leagues(@RequestParam(required = false) String recordId) {
        return auditService.leagueAudit(recordId);
    }

    @GetMapping("/teams")
    public List<AuditTeam> teams(@RequestParam(required = false) String recordId) {
        return auditService.teamAudit(recordId);
    }

    @GetMapping("/cricketers")
    public List<AuditCricketer> cricketers(@RequestParam(required = false) String recordId) {
        return auditService.cricketerAudit(recordId);
    }
}
