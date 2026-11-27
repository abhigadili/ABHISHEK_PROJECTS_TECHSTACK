package com.cricket.repository.impl;

import com.cricket.model.Country;
import com.cricket.repository.CountryRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

/**
 * Every method binds user input as a JdbcTemplate '?' parameter — the SQL text
 * itself is always a fixed literal written by the developer, so no value
 * passed in from a controller can change what statement actually runs.
 */
@Repository
public class CountryRepositoryImpl implements CountryRepository {

    private final JdbcTemplate jdbcTemplate;

    public CountryRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<Country> ROW_MAPPER = (rs, rowNum) -> {
        Country c = new Country();
        c.setId(rs.getString("id"));
        c.setName(rs.getString("name"));
        c.setShortName(rs.getString("short_name"));
        c.setFlag(rs.getString("flag"));
        c.setDescription(rs.getString("description"));
        c.setBackground(rs.getString("background"));
        c.setEstablished((Integer) rs.getObject("established"));
        c.setWorldCupsWon((Integer) rs.getObject("world_cups_won"));
        c.setBoard(rs.getString("board"));
        c.setCoach(rs.getString("coach"));
        c.setCaptain(rs.getString("captain"));
        c.setFamousPlayers(rs.getString("famous_players"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) c.setCreatedAt(createdAt.toLocalDateTime());
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) c.setUpdatedAt(updatedAt.toLocalDateTime());
        return c;
    };

    @Override
    public List<Country> findAll() {
        return jdbcTemplate.query("SELECT * FROM countries ORDER BY name", ROW_MAPPER);
    }

    @Override
    public List<Country> search(String term) {
        String like = "%" + term + "%";
        return jdbcTemplate.query(
                "SELECT * FROM countries WHERE name LIKE ? OR short_name LIKE ? OR board LIKE ? ORDER BY name",
                ROW_MAPPER, like, like, like);
    }

    @Override
    public Optional<Country> findById(String id) {
        try {
            Country c = jdbcTemplate.queryForObject("SELECT * FROM countries WHERE id = ?", ROW_MAPPER, id);
            return Optional.ofNullable(c);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public boolean existsById(String id) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM countries WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    @Override
    public Country insert(Country country) {
        jdbcTemplate.update(
                "INSERT INTO countries (id, name, short_name, flag, description, background, " +
                "established, world_cups_won, board, coach, captain, famous_players) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                country.getId(), country.getName(), country.getShortName(), country.getFlag(),
                country.getDescription(), country.getBackground(), country.getEstablished(),
                country.getWorldCupsWon(), country.getBoard(), country.getCoach(),
                country.getCaptain(), country.getFamousPlayers());
        return findById(country.getId()).orElseThrow();
    }

    @Override
    public int update(Country country) {
        return jdbcTemplate.update(
                "UPDATE countries SET name = ?, short_name = ?, flag = ?, description = ?, " +
                "background = ?, established = ?, world_cups_won = ?, board = ?, coach = ?, " +
                "captain = ?, famous_players = ? WHERE id = ?",
                country.getName(), country.getShortName(), country.getFlag(), country.getDescription(),
                country.getBackground(), country.getEstablished(), country.getWorldCupsWon(),
                country.getBoard(), country.getCoach(), country.getCaptain(),
                country.getFamousPlayers(), country.getId());
    }

    @Override
    public int deleteById(String id) {
        return jdbcTemplate.update("DELETE FROM countries WHERE id = ?", id);
    }
}
