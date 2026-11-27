package com.cricket.repository.impl;

import com.cricket.model.League;
import com.cricket.repository.LeagueRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public class LeagueRepositoryImpl implements LeagueRepository {

    private final JdbcTemplate jdbcTemplate;

    public LeagueRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<League> ROW_MAPPER = (rs, rowNum) -> {
        League l = new League();
        l.setId(rs.getString("id"));
        l.setCountryId(rs.getString("country_id"));
        l.setName(rs.getString("name"));
        l.setDescription(rs.getString("description"));
        l.setEstablished((Integer) rs.getObject("established"));
        l.setFormat(rs.getString("format"));
        l.setTrophy(rs.getString("trophy"));
        l.setImage(rs.getString("image"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) l.setCreatedAt(createdAt.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) l.setUpdatedAt(updatedAt.toLocalDateTime());
        return l;
    };

    @Override
    public List<League> findAll() {
        return jdbcTemplate.query("SELECT * FROM leagues ORDER BY name", ROW_MAPPER);
    }

    @Override
    public List<League> findByCountryId(String countryId) {
        return jdbcTemplate.query(
                "SELECT * FROM leagues WHERE country_id = ? ORDER BY name", ROW_MAPPER, countryId);
    }

    @Override
    public List<League> search(String term) {
        return jdbcTemplate.query(
                "SELECT * FROM leagues WHERE name LIKE ? ORDER BY name", ROW_MAPPER, "%" + term + "%");
    }

    @Override
    public List<League> findByCountryIdAndSearch(String countryId, String term) {
        return jdbcTemplate.query(
                "SELECT * FROM leagues WHERE country_id = ? AND name LIKE ? ORDER BY name",
                ROW_MAPPER, countryId, "%" + term + "%");
    }

    @Override
    public Optional<League> findById(String id) {
        try {
            return Optional.ofNullable(
                    jdbcTemplate.queryForObject("SELECT * FROM leagues WHERE id = ?", ROW_MAPPER, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(String id) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM leagues WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    @Override
    public League insert(League league) {
        jdbcTemplate.update(
                "INSERT INTO leagues (id, country_id, name, description, established, format, trophy, image) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                league.getId(), league.getCountryId(), league.getName(), league.getDescription(),
                league.getEstablished(), league.getFormat(), league.getTrophy(), league.getImage());
        return findById(league.getId()).orElseThrow();
    }

    @Override
    public int update(League league) {
        return jdbcTemplate.update(
                "UPDATE leagues SET country_id = ?, name = ?, description = ?, established = ?, " +
                "format = ?, trophy = ?, image = ? WHERE id = ?",
                league.getCountryId(), league.getName(), league.getDescription(), league.getEstablished(),
                league.getFormat(), league.getTrophy(), league.getImage(), league.getId());
    }

    @Override
    public int deleteById(String id) {
        return jdbcTemplate.update("DELETE FROM leagues WHERE id = ?", id);
    }
}
