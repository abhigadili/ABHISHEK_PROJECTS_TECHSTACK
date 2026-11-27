package com.cricket.repository.impl;

import com.cricket.model.AuditCountry;
import com.cricket.model.AuditCricketer;
import com.cricket.model.AuditLeague;
import com.cricket.model.AuditTeam;
import com.cricket.repository.AuditRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public class AuditRepositoryImpl implements AuditRepository {

    private final JdbcTemplate jdbcTemplate;

    public AuditRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<AuditCountry> COUNTRY_MAPPER = (rs, rowNum) -> {
        AuditCountry a = new AuditCountry();
        a.setAuditId(rs.getInt("audit_id"));
        a.setOperation(rs.getString("operation"));
        a.setRecordId(rs.getString("record_id"));
        a.setOldName(rs.getString("old_name"));
        a.setNewName(rs.getString("new_name"));
        a.setOldCaptain(rs.getString("old_captain"));
        a.setNewCaptain(rs.getString("new_captain"));
        a.setOldCoach(rs.getString("old_coach"));
        a.setNewCoach(rs.getString("new_coach"));
        a.setOldWorldCupsWon((Integer) rs.getObject("old_world_cups_won"));
        a.setNewWorldCupsWon((Integer) rs.getObject("new_world_cups_won"));
        a.setChangedBy(rs.getString("changed_by"));
        Timestamp changedAt = rs.getTimestamp("changed_at");
        if (changedAt != null) a.setChangedAt(changedAt.toLocalDateTime());
        return a;
    };

    private static final RowMapper<AuditLeague> LEAGUE_MAPPER = (rs, rowNum) -> {
        AuditLeague a = new AuditLeague();
        a.setAuditId(rs.getInt("audit_id"));
        a.setOperation(rs.getString("operation"));
        a.setRecordId(rs.getString("record_id"));
        a.setOldName(rs.getString("old_name"));
        a.setNewName(rs.getString("new_name"));
        a.setOldCountryId(rs.getString("old_country_id"));
        a.setNewCountryId(rs.getString("new_country_id"));
        a.setOldFormat(rs.getString("old_format"));
        a.setNewFormat(rs.getString("new_format"));
        a.setChangedBy(rs.getString("changed_by"));
        Timestamp changedAt = rs.getTimestamp("changed_at");
        if (changedAt != null) a.setChangedAt(changedAt.toLocalDateTime());
        return a;
    };

    private static final RowMapper<AuditTeam> TEAM_MAPPER = (rs, rowNum) -> {
        AuditTeam a = new AuditTeam();
        a.setAuditId(rs.getInt("audit_id"));
        a.setOperation(rs.getString("operation"));
        a.setRecordId(rs.getString("record_id"));
        a.setOldName(rs.getString("old_name"));
        a.setNewName(rs.getString("new_name"));
        a.setOldLeagueId(rs.getString("old_league_id"));
        a.setNewLeagueId(rs.getString("new_league_id"));
        a.setOldCaptain(rs.getString("old_captain"));
        a.setNewCaptain(rs.getString("new_captain"));
        a.setOldTitles((Integer) rs.getObject("old_titles"));
        a.setNewTitles((Integer) rs.getObject("new_titles"));
        a.setChangedBy(rs.getString("changed_by"));
        Timestamp changedAt = rs.getTimestamp("changed_at");
        if (changedAt != null) a.setChangedAt(changedAt.toLocalDateTime());
        return a;
    };

    private static final RowMapper<AuditCricketer> CRICKETER_MAPPER = (rs, rowNum) -> {
        AuditCricketer a = new AuditCricketer();
        a.setAuditId(rs.getInt("audit_id"));
        a.setOperation(rs.getString("operation"));
        a.setRecordId(rs.getString("record_id"));
        a.setOldName(rs.getString("old_name"));
        a.setNewName(rs.getString("new_name"));
        a.setOldTeamId(rs.getString("old_team_id"));
        a.setNewTeamId(rs.getString("new_team_id"));
        a.setOldRole(rs.getString("old_role"));
        a.setNewRole(rs.getString("new_role"));
        a.setOldRuns((Integer) rs.getObject("old_runs"));
        a.setNewRuns((Integer) rs.getObject("new_runs"));
        a.setOldWickets((Integer) rs.getObject("old_wickets"));
        a.setNewWickets((Integer) rs.getObject("new_wickets"));
        a.setChangedBy(rs.getString("changed_by"));
        Timestamp changedAt = rs.getTimestamp("changed_at");
        if (changedAt != null) a.setChangedAt(changedAt.toLocalDateTime());
        return a;
    };

    @Override
    public List<AuditCountry> findCountryAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return jdbcTemplate.query("SELECT * FROM audit_countries ORDER BY changed_at DESC", COUNTRY_MAPPER);
        }
        return jdbcTemplate.query(
                "SELECT * FROM audit_countries WHERE record_id = ? ORDER BY changed_at DESC",
                COUNTRY_MAPPER, recordId);
    }

    @Override
    public List<AuditLeague> findLeagueAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return jdbcTemplate.query("SELECT * FROM audit_leagues ORDER BY changed_at DESC", LEAGUE_MAPPER);
        }
        return jdbcTemplate.query(
                "SELECT * FROM audit_leagues WHERE record_id = ? ORDER BY changed_at DESC",
                LEAGUE_MAPPER, recordId);
    }

    @Override
    public List<AuditTeam> findTeamAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return jdbcTemplate.query("SELECT * FROM audit_teams ORDER BY changed_at DESC", TEAM_MAPPER);
        }
        return jdbcTemplate.query(
                "SELECT * FROM audit_teams WHERE record_id = ? ORDER BY changed_at DESC",
                TEAM_MAPPER, recordId);
    }

    @Override
    public List<AuditCricketer> findCricketerAudit(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            return jdbcTemplate.query("SELECT * FROM audit_cricketers ORDER BY changed_at DESC", CRICKETER_MAPPER);
        }
        return jdbcTemplate.query(
                "SELECT * FROM audit_cricketers WHERE record_id = ? ORDER BY changed_at DESC",
                CRICKETER_MAPPER, recordId);
    }
}
