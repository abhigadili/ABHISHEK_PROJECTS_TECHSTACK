package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.Country;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object for the countries table.
 * Demonstrates: SELECT, INSERT, UPDATE, DELETE with PreparedStatement.
 */
public class CountryDAO {

    // ── READ ALL ─────────────────────────────────────────────────────────────
    public List<Country> findAll() throws SQLException {
        List<Country> list = new ArrayList<>();
        String sql = "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established FROM countries ORDER BY name";
        try (Connection con = DBConnection.getConnection();
             Statement  st  = con.createStatement();
             ResultSet  rs  = st.executeQuery(sql)) {
            while (rs.next()) {
                list.add(mapRow(rs));
            }
        }
        return list;
    }

    // ── READ BY ID ───────────────────────────────────────────────────────────
    public Country findById(String id) throws SQLException {
        String sql = "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established FROM countries WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    // ── SEARCH ───────────────────────────────────────────────────────────────
    public List<Country> search(String term) throws SQLException {
        List<Country> list = new ArrayList<>();
        String sql = "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established " +
                     "FROM countries WHERE name LIKE ? OR board LIKE ? ORDER BY name";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            String like = "%" + term + "%";
            ps.setString(1, like);
            ps.setString(2, like);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    // ── INSERT ───────────────────────────────────────────────────────────────
    public boolean insert(Country c) throws SQLException {
        String sql = "INSERT INTO countries (id, name, short_name, flag, board, captain, coach, world_cups_won, established) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
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
            return ps.executeUpdate() > 0;
        }
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    public boolean update(Country c) throws SQLException {
        String sql = "UPDATE countries SET name=?, short_name=?, board=?, captain=?, coach=?, world_cups_won=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, c.getName());
            ps.setString(2, c.getShortName());
            ps.setString(3, c.getBoard());
            ps.setString(4, c.getCaptain());
            ps.setString(5, c.getCoach());
            ps.setInt   (6, c.getWorldCupsWon());
            ps.setString(7, c.getId());
            return ps.executeUpdate() > 0;
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    public boolean delete(String id) throws SQLException {
        String sql = "DELETE FROM countries WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    // ── COUNT ────────────────────────────────────────────────────────────────
    public int count() throws SQLException {
        String sql = "SELECT COUNT(*) FROM countries";
        try (Connection con = DBConnection.getConnection();
             Statement st = con.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    // ── ROW MAPPER ───────────────────────────────────────────────────────────
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
}
