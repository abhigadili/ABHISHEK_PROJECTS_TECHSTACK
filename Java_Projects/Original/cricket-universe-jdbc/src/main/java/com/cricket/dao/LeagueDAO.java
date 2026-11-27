package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.League;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * DAO for the leagues table.
 */
public class LeagueDAO {

    public List<League> findAll() throws SQLException {
        List<League> list = new ArrayList<>();
        String sql = "SELECT l.id, l.country_id, c.name AS country_name, l.name, l.format, " +
                     "COALESCE(l.established, 0) AS established, l.description " +
                     "FROM leagues l JOIN countries c ON c.id = l.country_id ORDER BY c.name, l.name";
        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<League> findByCountry(String countryId) throws SQLException {
        List<League> list = new ArrayList<>();
        String sql = "SELECT l.id, l.country_id, c.name AS country_name, l.name, l.format, " +
                     "COALESCE(l.established, 0) AS established, l.description " +
                     "FROM leagues l JOIN countries c ON c.id = l.country_id " +
                     "WHERE l.country_id = ? ORDER BY l.name";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, countryId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public boolean insert(League l) throws SQLException {
        String sql = "INSERT INTO leagues (id, country_id, name, format, established, description) VALUES (?,?,?,?,?,?)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, l.getId());
            ps.setString(2, l.getCountryId());
            ps.setString(3, l.getName());
            ps.setString(4, l.getFormat());
            ps.setInt   (5, l.getEstablished());
            ps.setString(6, l.getDescription());
            return ps.executeUpdate() > 0;
        }
    }

    public boolean update(League l) throws SQLException {
        String sql = "UPDATE leagues SET name=?, format=?, established=?, description=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, l.getName());
            ps.setString(2, l.getFormat());
            ps.setInt   (3, l.getEstablished());
            ps.setString(4, l.getDescription());
            ps.setString(5, l.getId());
            return ps.executeUpdate() > 0;
        }
    }

    public boolean delete(String id) throws SQLException {
        String sql = "DELETE FROM leagues WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public int count() throws SQLException {
        try (Connection con = DBConnection.getConnection();
             Statement st = con.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM leagues")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private League mapRow(ResultSet rs) throws SQLException {
        League l = new League();
        l.setId         (rs.getString("id"));
        l.setCountryId  (rs.getString("country_id"));
        l.setCountryName(rs.getString("country_name"));
        l.setName       (rs.getString("name"));
        l.setFormat     (rs.getString("format"));
        l.setEstablished(rs.getInt   ("established"));
        l.setDescription(rs.getString("description"));
        return l;
    }
}
