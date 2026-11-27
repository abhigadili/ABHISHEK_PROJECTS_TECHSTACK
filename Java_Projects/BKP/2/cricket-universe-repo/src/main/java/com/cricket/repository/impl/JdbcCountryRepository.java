package com.cricket.repository.impl;

import com.cricket.config.DBConnection;
import com.cricket.model.Country;
import com.cricket.repository.CountryRepository;

import java.sql.*;
import java.util.*;

/**
 * JDBC implementation of CountryRepository.
 *
 * SQL-injection prevention:
 *   Every user-supplied value arrives via PreparedStatement '?' placeholders.
 *   The JDBC driver sends SQL text and parameter values as separate protocol
 *   messages — the database engine never parses user data as SQL syntax.
 */
public class JdbcCountryRepository implements CountryRepository {

    private static final String SELECT_BASE =
        "SELECT id, name, short_name, flag, board, captain, coach, " +
        "COALESCE(world_cups_won,0) AS world_cups_won, " +
        "COALESCE(established,0) AS established FROM countries";

    private Country mapRow(ResultSet rs) throws SQLException {
        Country c = new Country();
        c.setId          (rs.getString("id"));
        c.setName        (rs.getString("name"));
        c.setShortName   (rs.getString("short_name"));
        c.setFlag        (rs.getString("flag"));
        c.setBoard       (rs.getString("board"));
        c.setCaptain     (rs.getString("captain"));
        c.setCoach       (rs.getString("coach"));
        c.setWorldCupsWon(rs.getInt   ("world_cups_won"));
        c.setEstablished (rs.getInt   ("established"));
        return c;
    }

    @Override
    public List<Country> findAll() throws SQLException {
        List<Country> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " ORDER BY name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    @Override
    public Optional<Country> findById(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public List<Country> search(String keyword) throws SQLException {
        if (keyword == null || keyword.isBlank()) return findAll();
        String like = "%" + keyword + "%";
        String sql  = SELECT_BASE + " WHERE name LIKE ? OR short_name LIKE ? OR board LIKE ? ORDER BY name";
        List<Country> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, like);
            ps.setString(2, like);
            ps.setString(3, like);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    @Override
    public Country save(Country c) throws SQLException {
        String sql = "INSERT INTO countries (id, name, short_name, flag, board, captain, coach, world_cups_won, established) " +
                     "VALUES (?,?,?,?,?,?,?,?,?)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, c.getId());
            ps.setString(2, c.getName());
            ps.setString(3, c.getShortName());
            ps.setString(4, c.getFlag());
            ps.setString(5, c.getBoard());
            ps.setString(6, c.getCaptain());
            ps.setString(7, c.getCoach());
            ps.setInt   (8, c.getWorldCupsWon());
            ps.setInt   (9, c.getEstablished());
            ps.executeUpdate();
        }
        return c;
    }

    @Override
    public Optional<Country> update(String id, Country c) throws SQLException {
        String sql = "UPDATE countries SET name=?, short_name=?, flag=?, board=?, captain=?, coach=?, world_cups_won=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, c.getName());
            ps.setString(2, c.getShortName());
            ps.setString(3, c.getFlag());
            ps.setString(4, c.getBoard());
            ps.setString(5, c.getCaptain());
            ps.setString(6, c.getCoach());
            ps.setInt   (7, c.getWorldCupsWon());
            ps.setString(8, id);
            return ps.executeUpdate() > 0 ? findById(id) : Optional.empty();
        }
    }

    @Override
    public boolean delete(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("DELETE FROM countries WHERE id = ?")) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }
}
