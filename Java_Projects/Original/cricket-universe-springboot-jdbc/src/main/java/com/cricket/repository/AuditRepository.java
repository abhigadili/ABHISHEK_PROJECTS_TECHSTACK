package com.cricket.repository;

import com.cricket.model.AuditCountry;
import com.cricket.model.AuditCricketer;
import com.cricket.model.AuditLeague;
import com.cricket.model.AuditTeam;

import java.util.List;

/**
 * Read-only access to the four audit trail tables. Rows are written
 * exclusively by MySQL triggers whenever a country/league/team/cricketer row
 * is inserted, updated or deleted — this repository never writes to them.
 */
public interface AuditRepository {

    List<AuditCountry> findCountryAudit(String recordId);

    List<AuditLeague> findLeagueAudit(String recordId);

    List<AuditTeam> findTeamAudit(String recordId);

    List<AuditCricketer> findCricketerAudit(String recordId);
}
