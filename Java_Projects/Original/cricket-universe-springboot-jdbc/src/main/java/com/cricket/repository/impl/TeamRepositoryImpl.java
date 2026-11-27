package com.cricket.repository.impl;

import com.cricket.model.Team;
import com.cricket.repository.TeamRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public class TeamRepositoryImpl implements TeamRepository {

    private final JdbcTemplate jdbcTemplate;

    public TeamRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<Team> ROW_MAPPER = (rs, rowNum) -> {
        Team t = new Team();
        t.setId(rs.getString("id"));
        t.setLeagueId(rs.getString("league_id"));
        t.setName(rs.getString("name"));
        t.setCaptain(rs.getString("captain"));
        t.setCoach(rs.getString("coach"));
        t.setHomeGround(rs.getString("home_ground"));
        t.setTitles((Integer) rs.getObject("titles"));
        t.setLogo(rs.getString("logo"));
        t.setDescription(rs.getString("description"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) t.setCreatedAt(createdAt.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) t.setUpdatedAt(updatedAt.toLocalDateTime());
        return t;
    };

    @Override
    public List<Team> findAll() {
        return jdbcTemplate.query("SELECT * FROM teams ORDER BY name", ROW_MAPPER);
    }

    @Override
    public List<Team> findByLeagueId(String leagueId) {
        return jdbcTemplate.query(
                "SELECT * FROM teams WHERE league_id = ? ORDER BY name", ROW_MAPPER, leagueId);
    }

    @Override
    public Optional<Team> findById(String id) {
        try {
            return Optional.ofNullable(
                    jdbcTemplate.queryForObject("SELECT * FROM teams WHERE id = ?", ROW_MAPPER, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(String id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM teams WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    @Override
    public Team insert(Team team) {
        jdbcTemplate.update(
                "INSERT INTO teams (id, league_id, name, captain, coach, home_ground, titles, logo, description) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                team.getId(), team.getLeagueId(), team.getName(), team.getCaptain(), team.getCoach(),
                team.getHomeGround(), team.getTitles(), team.getLogo(), team.getDescription());
        return findById(team.getId()).orElseThrow();
    }

    @Override
    public int update(Team team) {
        return jdbcTemplate.update(
                "UPDATE teams SET league_id = ?, name = ?, captain = ?, coach = ?, home_ground = ?, " +
                "titles = ?, logo = ?, description = ? WHERE id = ?",
                team.getLeagueId(), team.getName(), team.getCaptain(), team.getCoach(), team.getHomeGround(),
                team.getTitles(), team.getLogo(), team.getDescription(), team.getId());
    }

    @Override
    public int deleteById(String id) {
        return jdbcTemplate.update("DELETE FROM teams WHERE id = ?", id);
    }
}
