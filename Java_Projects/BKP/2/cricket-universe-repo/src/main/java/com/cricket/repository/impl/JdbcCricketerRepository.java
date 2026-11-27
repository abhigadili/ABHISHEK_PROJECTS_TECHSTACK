package com.cricket.repository.impl;

import com.cricket.config.DBConnection;
import com.cricket.model.Cricketer;
import com.cricket.repository.CricketerRepository;

import java.sql.*;
import java.util.*;

public class JdbcCricketerRepository implements CricketerRepository {

    private static final String SELECT_BASE =
        "SELECT cr.id, cr.team_id, t.name AS team_name, cr.name, cr.role, " +
        "cr.batting_style, cr.bowling_style, COALESCE(cr.age,0) AS age, " +
        "COALESCE(cr.matches,0) AS matches, COALESCE(cr.runs,0) AS runs, " +
        "COALESCE(cr.wickets,0) AS wickets, cr.country " +
        "FROM cricketers cr JOIN teams t ON t.id = cr.team_id";

    private Cricketer mapRow(ResultSet rs) throws SQLException {
        Cricketer cr = new Cricketer();
        cr.setId          (rs.getString("id"));
        cr.setTeamId      (rs.getString("team_id"));
        cr.setTeamName    (rs.getString("team_name"));
        cr.setName        (rs.getString("name"));
        cr.setRole        (rs.getString("role"));
        cr.setBattingStyle(rs.getString("batting_style"));
        cr.setBowlingStyle(rs.getString("bowling_style"));
        cr.setAge         (rs.getInt   ("age"));
        cr.setMatches     (rs.getInt   ("matches"));
        cr.setRuns        (rs.getInt   ("runs"));
        cr.setWickets     (rs.getInt   ("wickets"));
        cr.setCountry     (rs.getString("country"));
        return cr;
    }

    @Override
    public List<Cricketer> findAll() throws SQLException {
        List<Cricketer> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " ORDER BY cr.name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    @Override
    public Optional<Cricketer> findById(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " WHERE cr.id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public List<Cricketer> findByTeamAndRole(String teamId, String role) throws SQLException {
        StringBuilder sb = new StringBuilder(SELECT_BASE + " WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (teamId != null && !teamId.isBlank()) { sb.append(" AND cr.team_id = ?"); params.add(teamId); }
        if (role   != null && !role.isBlank())   { sb.append(" AND cr.role = ?");    params.add(role); }
        sb.append(" ORDER BY cr.name");

        List<Cricketer> list = new ArrayList<>();
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
    public Cricketer save(Cricketer cr) throws SQLException {
        String sql = "INSERT INTO cricketers (id, team_id, name, role, batting_style, bowling_style, age, matches, runs, wickets, country) " +
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1,  cr.getId());
            ps.setString(2,  cr.getTeamId());
            ps.setString(3,  cr.getName());
            ps.setString(4,  cr.getRole());
            ps.setString(5,  cr.getBattingStyle());
            ps.setString(6,  cr.getBowlingStyle());
            ps.setInt   (7,  cr.getAge());
            ps.setInt   (8,  cr.getMatches());
            ps.setInt   (9,  cr.getRuns());
            ps.setInt   (10, cr.getWickets());
            ps.setString(11, cr.getCountry());
            ps.executeUpdate();
        }
        return cr;
    }

    @Override
    public Optional<Cricketer> update(String id, Cricketer cr) throws SQLException {
        String sql = "UPDATE cricketers SET name=?, role=?, batting_style=?, bowling_style=?, matches=?, runs=?, wickets=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, cr.getName());
            ps.setString(2, cr.getRole());
            ps.setString(3, cr.getBattingStyle());
            ps.setString(4, cr.getBowlingStyle());
            ps.setInt   (5, cr.getMatches());
            ps.setInt   (6, cr.getRuns());
            ps.setInt   (7, cr.getWickets());
            ps.setString(8, id);
            return ps.executeUpdate() > 0 ? findById(id) : Optional.empty();
        }
    }

    @Override
    public boolean delete(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("DELETE FROM cricketers WHERE id = ?")) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }
}
