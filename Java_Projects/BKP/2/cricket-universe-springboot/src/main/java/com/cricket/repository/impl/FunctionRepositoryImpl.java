package com.cricket.repository.impl;

import com.cricket.repository.FunctionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Every call below uses JdbcTemplate's '?' placeholders — user-supplied
 * runs/matches/role/name/team values are always sent as bind parameters,
 * never spliced into the SQL text, so these UDF calls are immune to SQL
 * injection regardless of what a caller passes in.
 */
@Repository
public class FunctionRepositoryImpl implements FunctionRepository {

    private final JdbcTemplate jdbcTemplate;

    public FunctionRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public BigDecimal battingAverage(int runs, int matches) {
        return jdbcTemplate.queryForObject(
                "SELECT fn_batting_average(?, ?)", BigDecimal.class, runs, matches);
    }

    @Override
    public String playerGrade(int runs, int wickets, String role) {
        return jdbcTemplate.queryForObject(
                "SELECT fn_player_grade(?, ?, ?)", String.class, runs, wickets, role);
    }

    @Override
    public String formatPlayerLabel(String name, String role, String team) {
        return jdbcTemplate.queryForObject(
                "SELECT fn_format_player_label(?, ?, ?)", String.class, name, role, team);
    }

    private static final RowMapper<Map<String, Object>> ROW_MAPPER = (rs, rowNum) -> {
        Map<String, Object> row = new LinkedHashMap<>();
        int cols = rs.getMetaData().getColumnCount();
        for (int i = 1; i <= cols; i++) {
            row.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
        }
        return row;
    };

    @Override
    public List<Map<String, Object>> findAllPlayersWithComputedStats() {
        String sql =
                "SELECT cr.id, cr.name, cr.role, t.name AS team_name, " +
                "COALESCE(cr.runs,0) AS runs, COALESCE(cr.wickets,0) AS wickets, " +
                "COALESCE(cr.matches,0) AS matches, " +
                "fn_batting_average(COALESCE(cr.runs,0), GREATEST(COALESCE(cr.matches,1),1)) AS batting_average, " +
                "fn_player_grade(COALESCE(cr.runs,0), COALESCE(cr.wickets,0), cr.role) AS player_grade, " +
                "fn_format_player_label(cr.name, cr.role, t.name) AS player_label " +
                "FROM cricketers cr JOIN teams t ON t.id = cr.team_id ORDER BY cr.name";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }
}
