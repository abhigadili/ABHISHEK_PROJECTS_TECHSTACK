package com.cricket.repository.impl;

import com.cricket.config.DBConnection;
import com.cricket.model.League;
import com.cricket.repository.LeagueRepository;

import java.sql.*;
import java.util.*;

public class JdbcLeagueRepository implements LeagueRepository {

    private static final String SELECT_BASE =
        "SELECT l.id, l.country_id, c.name AS country_name, l.name, l.format, " +
        "COALESCE(l.established,0) AS established, l.description " +
        "FROM leagues l JOIN countries c ON c.id = l.country_id";

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

    @Override
    public List<League> findAll() throws SQLException {
        List<League> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " ORDER BY c.name, l.name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    @Override
    public Optional<League> findById(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " WHERE l.id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public List<League> findByCountry(String countryId, String keyword) throws SQLException {
        StringBuilder sb = new StringBuilder(SELECT_BASE + " WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (countryId != null && !countryId.isBlank()) { sb.append(" AND l.country_id = ?"); params.add(countryId); }
        if (keyword   != null && !keyword.isBlank())   { sb.append(" AND l.name LIKE ?");   params.add("%" + keyword + "%"); }
        sb.append(" ORDER BY c.name, l.name");

        List<League> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sb.toString())) {
            for (int i = 0; i < params.size(); i++) ps.setObject(i + 1, params.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    @Override
    public League save(League l) throws SQLException {
        String sql = "INSERT INTO leagues (id, country_id, name, format, established, description) VALUES (?,?,?,?,?,?)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, l.getId());
            ps.setString(2, l.getCountryId());
            ps.setString(3, l.getName());
            ps.setString(4, l.getFormat());
            ps.setInt   (5, l.getEstablished());
            ps.setString(6, l.getDescription());
            ps.executeUpdate();
        }
        return l;
    }

    @Override
    public Optional<League> update(String id, League l) throws SQLException {
        String sql = "UPDATE leagues SET name=?, format=?, established=?, description=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, l.getName());
            ps.setString(2, l.getFormat());
            ps.setInt   (3, l.getEstablished());
            ps.setString(4, l.getDescription());
            ps.setString(5, id);
            return ps.executeUpdate() > 0 ? findById(id) : Optional.empty();
        }
    }

    @Override
    public boolean delete(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("DELETE FROM leagues WHERE id = ?")) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }
}
