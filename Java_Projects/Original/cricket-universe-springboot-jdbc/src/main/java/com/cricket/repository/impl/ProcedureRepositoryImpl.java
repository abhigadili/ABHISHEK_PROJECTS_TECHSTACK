package com.cricket.repository.impl;

import com.cricket.repository.ProcedureRepository;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.CallableStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * All eight stored procedures are invoked through CallableStatement with '?'
 * placeholders bound via setString/setNull — the same PreparedStatement-style
 * binding JdbcTemplate itself relies on. No procedure name or user value is
 * ever concatenated into the '{CALL ...}' text, so this layer cannot be used
 * to inject SQL through a parameter.
 */
@Repository
public class ProcedureRepositoryImpl implements ProcedureRepository {

    private static final Logger log = LogManager.getLogger(ProcedureRepositoryImpl.class);

    private final JdbcTemplate jdbcTemplate;

    public ProcedureRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<Map<String, Object>> listCountries(String search) {
        return callSingleResultSet("{CALL sp_list_countries(?)}", search);
    }

    @Override
    public List<Map<String, Object>> listLeagues(String countryId, String search) {
        return callSingleResultSet("{CALL sp_list_leagues(?,?)}", countryId, search);
    }

    @Override
    public List<Map<String, Object>> listTeams(String leagueId) {
        return callSingleResultSet("{CALL sp_list_teams(?)}", leagueId);
    }

    @Override
    public List<Map<String, Object>> listPlayers(String teamId, String role) {
        return callSingleResultSet("{CALL sp_list_players(?,?)}", teamId, role);
    }

    @Override
    public List<Map<String, Object>> allPlayersDetail(String countryId, String role) {
        return callSingleResultSet("{CALL sp_all_players_detail(?,?)}", countryId, role);
    }

    @Override
    public List<Map<String, Object>> cursorRoleRunTotals() {
        return callSingleResultSet("{CALL sp_cursor_role_run_totals()}");
    }

    @Override
    public Map<String, List<Map<String, Object>>> windowFunctionsDemo() {
        return callMultiResultSet("{CALL sp_window_functions_demo()}",
                "rankingWithinTeam",
                "cumulativeRunsByCountry",
                "teamTitleQuartiles",
                "lagLeadRuns",
                "firstLastValueByLeague");
    }

    @Override
    public Map<String, List<Map<String, Object>>> analyticsDemo() {
        return callMultiResultSet("{CALL sp_analytics_demo()}",
                "roleWiseStats",
                "allPlayersWithJoinDetails",
                "countryLeagueStats",
                "stringDateBuiltinFunctions",
                "aboveCountryAveragePlayers",
                "performanceTiers",
                "aboveLeagueAveragePlayers",
                "t20PlayingCountries");
    }

    // ---- shared helpers -------------------------------------------------

    private List<Map<String, Object>> callSingleResultSet(String call, String... params) {
        log.debug("Calling procedure: {} with params={}", call, params);
        return jdbcTemplate.execute((java.sql.Connection con) -> {
            List<Map<String, Object>> rows = new ArrayList<>();
            try (CallableStatement cs = con.prepareCall(call)) {
                bindParams(cs, params);
                if (cs.execute()) {
                    try (ResultSet rs = cs.getResultSet()) {
                        rows.addAll(readResultSet(rs));
                    }
                }
            }
            log.debug("Procedure {} returned {} rows", call, rows.size());
            return rows;
        });
    }

    private Map<String, List<Map<String, Object>>> callMultiResultSet(String call, String... sectionLabels) {
        log.debug("Calling multi-resultset procedure: {}", call);
        return jdbcTemplate.execute((java.sql.Connection con) -> {
            Map<String, List<Map<String, Object>>> sections = new LinkedHashMap<>();
            try (CallableStatement cs = con.prepareCall(call)) {
                boolean hasResult = cs.execute();
                int sectionIndex = 0;
                while (hasResult) {
                    try (ResultSet rs = cs.getResultSet()) {
                        String label = sectionIndex < sectionLabels.length
                                ? sectionLabels[sectionIndex]
                                : "resultSet" + sectionIndex;
                        sections.put(label, readResultSet(rs));
                    }
                    sectionIndex++;
                    hasResult = cs.getMoreResults();
                }
            }
            log.debug("Procedure {} returned {} result sets", call, sections.size());
            return sections;
        });
    }

    private void bindParams(CallableStatement cs, String... params) throws SQLException {
        for (int i = 0; i < params.length; i++) {
            String value = params[i];
            if (value == null || value.isBlank()) {
                cs.setNull(i + 1, Types.VARCHAR);
            } else {
                cs.setString(i + 1, value);
            }
        }
    }

    private List<Map<String, Object>> readResultSet(ResultSet rs) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= cols; i++) {
                row.put(meta.getColumnLabel(i), rs.getObject(i));
            }
            rows.add(row);
        }
        return rows;
    }
}
