package com.cricket.repository.impl;

import com.cricket.model.Cricketer;
import com.cricket.repository.CricketerRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public class CricketerRepositoryImpl implements CricketerRepository {

    private final JdbcTemplate jdbcTemplate;

    public CricketerRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<Cricketer> ROW_MAPPER = (rs, rowNum) -> {
        Cricketer c = new Cricketer();
        c.setId(rs.getString("id"));
        c.setTeamId(rs.getString("team_id"));
        c.setName(rs.getString("name"));
        c.setCountry(rs.getString("country"));
        c.setRole(rs.getString("role"));
        c.setBattingStyle(rs.getString("batting_style"));
        c.setBowlingStyle(rs.getString("bowling_style"));
        c.setAge((Integer) rs.getObject("age"));
        c.setMatches((Integer) rs.getObject("matches"));
        c.setRuns((Integer) rs.getObject("runs"));
        c.setWickets((Integer) rs.getObject("wickets"));
        c.setDescription(rs.getString("description"));
        c.setImage(rs.getString("image"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) c.setCreatedAt(createdAt.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) c.setUpdatedAt(updatedAt.toLocalDateTime());
        return c;
    };

    @Override
    public List<Cricketer> findAll() {
        return jdbcTemplate.query("SELECT * FROM cricketers ORDER BY name", ROW_MAPPER);
    }

    @Override
    public List<Cricketer> findByTeamId(String teamId) {
        return jdbcTemplate.query(
                "SELECT * FROM cricketers WHERE team_id = ? ORDER BY name", ROW_MAPPER, teamId);
    }

    @Override
    public List<Cricketer> findByRole(String role) {
        return jdbcTemplate.query(
                "SELECT * FROM cricketers WHERE role = ? ORDER BY name", ROW_MAPPER, role);
    }

    @Override
    public List<Cricketer> findByTeamIdAndRole(String teamId, String role) {
        return jdbcTemplate.query(
                "SELECT * FROM cricketers WHERE team_id = ? AND role = ? ORDER BY name",
                ROW_MAPPER, teamId, role);
    }

    @Override
    public Optional<Cricketer> findById(String id) {
        try {
            return Optional.ofNullable(
                    jdbcTemplate.queryForObject("SELECT * FROM cricketers WHERE id = ?", ROW_MAPPER, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(String id) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cricketers WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    @Override
    public Cricketer insert(Cricketer cricketer) {
        jdbcTemplate.update(
                "INSERT INTO cricketers (id, team_id, name, country, role, batting_style, bowling_style, " +
                "age, matches, runs, wickets, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                cricketer.getId(), cricketer.getTeamId(), cricketer.getName(), cricketer.getCountry(),
                cricketer.getRole(), cricketer.getBattingStyle(), cricketer.getBowlingStyle(),
                cricketer.getAge(), cricketer.getMatches(), cricketer.getRuns(), cricketer.getWickets(),
                cricketer.getDescription(), cricketer.getImage());
        return findById(cricketer.getId()).orElseThrow();
    }

    @Override
    public int update(Cricketer cricketer) {
        return jdbcTemplate.update(
                "UPDATE cricketers SET team_id = ?, name = ?, country = ?, role = ?, batting_style = ?, " +
                "bowling_style = ?, age = ?, matches = ?, runs = ?, wickets = ?, description = ?, image = ? " +
                "WHERE id = ?",
                cricketer.getTeamId(), cricketer.getName(), cricketer.getCountry(), cricketer.getRole(),
                cricketer.getBattingStyle(), cricketer.getBowlingStyle(), cricketer.getAge(),
                cricketer.getMatches(), cricketer.getRuns(), cricketer.getWickets(),
                cricketer.getDescription(), cricketer.getImage(), cricketer.getId());
    }

    @Override
    public int deleteById(String id) {
        return jdbcTemplate.update("DELETE FROM cricketers WHERE id = ?", id);
    }
}
