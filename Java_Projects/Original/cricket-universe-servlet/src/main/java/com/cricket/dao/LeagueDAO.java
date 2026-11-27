package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.League;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class LeagueDAO {

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

    public List<League> findAll(String countryId, String search) throws SQLException {
        List<League> list = new ArrayList<>();
        StringBuilder sb = new StringBuilder(
            "SELECT l.id, l.country_id, c.name AS country_name, l.name, l.format, " +
            "COALESCE(l.established,0) AS established, l.description " +
            "FROM leagues l JOIN countries c ON c.id = l.country_id WHERE 1=1");

        List<Object> params = new ArrayList<>();

        if (countryId != null && !countryId.isBlank()) {
            sb.append(" AND l.country_id = ?");
            params.add(countryId);
        }
        if (search != null && !search.isBlank()) {
            sb.append(" AND l.name LIKE ?");
            params.add("%" + search + "%");
        }
        sb.append(" ORDER BY c.name, l.name");

        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sb.toString())) {
            for (int i = 0; i < params.size(); i++) ps.setObject(i + 1, params.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public League findById(String id) throws SQLException {
        String sql = "SELECT l.id, l.country_id, c.name AS country_name, l.name, l.format, " +
                     "COALESCE(l.established,0) AS established, l.description " +
                     "FROM leagues l JOIN countries c ON c.id = l.country_id WHERE l.id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
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

    public boolean update(String id, League l) throws SQLException {
        String sql = "UPDATE leagues SET name=?, format=?, established=?, description=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, l.getName());
            ps.setString(2, l.getFormat());
            ps.setInt   (3, l.getEstablished());
            ps.setString(4, l.getDescription());
            ps.setString(5, id);
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
}
