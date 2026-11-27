package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.Country;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * DAO for the countries table.
 *
 * SQL-Injection prevention:
 *   Every method that accepts user-supplied data uses PreparedStatement
 *   with '?' placeholders. The JDBC driver sends the parameter value
 *   separately from the SQL text — the database engine never interprets
 *   it as SQL, so injected tokens like  ' OR '1'='1  are treated as
 *   plain string data and never alter the query structure.
 */
public class CountryDAO {

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

    public List<Country> findAll(String search) throws SQLException {
        List<Country> list = new ArrayList<>();
        boolean hasSearch = search != null && !search.isBlank();

        String sql = hasSearch
            ? "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established " +
              "FROM countries WHERE name LIKE ? OR short_name LIKE ? OR board LIKE ? ORDER BY name"
            : "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established " +
              "FROM countries ORDER BY name";

        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {

            if (hasSearch) {
                String like = "%" + search + "%";
                ps.setString(1, like);
                ps.setString(2, like);
                ps.setString(3, like);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public Country findById(String id) throws SQLException {
        String sql = "SELECT id, name, short_name, flag, board, captain, coach, world_cups_won, established " +
                     "FROM countries WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    public boolean insert(Country c) throws SQLException {
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
            return ps.executeUpdate() > 0;
        }
    }

    public boolean update(String id, Country c) throws SQLException {
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
            return ps.executeUpdate() > 0;
        }
    }

    public boolean delete(String id) throws SQLException {
        String sql = "DELETE FROM countries WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }
}
