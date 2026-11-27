package com.cricket.repository.impl;

import com.cricket.repository.ViewRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ViewRepositoryImpl implements ViewRepository {

    private final JdbcTemplate jdbcTemplate;

    public ViewRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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
    public List<Map<String, Object>> findCountriesLeagues() {
        return jdbcTemplate.query("SELECT * FROM v_countries_leagues", ROW_MAPPER);
    }

    @Override
    public List<Map<String, Object>> findTeamsPlayers() {
        return jdbcTemplate.query("SELECT * FROM v_teams_players", ROW_MAPPER);
    }

    @Override
    public List<Map<String, Object>> findAllPlayersDetail() {
        return jdbcTemplate.query("SELECT * FROM v_all_players_detail", ROW_MAPPER);
    }
}
