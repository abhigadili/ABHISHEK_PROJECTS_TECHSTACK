package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.Cricketer;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * DAO for the cricketers table.
 */
public class CricketerDAO {

    public List<Cricketer> findAll() throws SQLException {
        List<Cricketer> list = new ArrayList<>();
        String sql = "SELECT cr.id, cr.team_id, t.name AS team_name, cr.name, cr.role, " +
                     "cr.batting_style, cr.bowling_style, COALESCE(cr.age,0) AS age, " +
                     "COALESCE(cr.matches,0) AS matches, COALESCE(cr.runs,0) AS runs, " +
                     "COALESCE(cr.wickets,0) AS wickets, cr.country " +
                     "FROM cricketers cr JOIN teams t ON t.id = cr.team_id ORDER BY cr.name";
        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<Cricketer> findByTeam(String teamId) throws SQLException {
        List<Cricketer> list = new ArrayList<>();
        String sql = "SELECT cr.id, cr.team_id, t.name AS team_name, cr.name, cr.role, " +
                     "cr.batting_style, cr.bowling_style, COALESCE(cr.age,0) AS age, " +
                     "COALESCE(cr.matches,0) AS matches, COALESCE(cr.runs,0) AS runs, " +
                     "COALESCE(cr.wickets,0) AS wickets, cr.country " +
                     "FROM cricketers cr JOIN teams t ON t.id = cr.team_id " +
                     "WHERE cr.team_id = ? ORDER BY cr.name";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, teamId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public List<Cricketer> findByRole(String role) throws SQLException {
        List<Cricketer> list = new ArrayList<>();
        String sql = "SELECT cr.id, cr.team_id, t.name AS team_name, cr.name, cr.role, " +
                     "cr.batting_style, cr.bowling_style, COALESCE(cr.age,0) AS age, " +
                     "COALESCE(cr.matches,0) AS matches, COALESCE(cr.runs,0) AS runs, " +
                     "COALESCE(cr.wickets,0) AS wickets, cr.country " +
                     "FROM cricketers cr JOIN teams t ON t.id = cr.team_id " +
                     "WHERE cr.role = ? ORDER BY cr.runs DESC";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, role);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public boolean insert(Cricketer cr) throws SQLException {
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
            return ps.executeUpdate() > 0;
        }
    }

    public boolean update(Cricketer cr) throws SQLException {
        String sql = "UPDATE cricketers SET name=?, role=?, matches=?, runs=?, wickets=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, cr.getName());
            ps.setString(2, cr.getRole());
            ps.setInt   (3, cr.getMatches());
            ps.setInt   (4, cr.getRuns());
            ps.setInt   (5, cr.getWickets());
            ps.setString(6, cr.getId());
            return ps.executeUpdate() > 0;
        }
    }

    public boolean delete(String id) throws SQLException {
        String sql = "DELETE FROM cricketers WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public int count() throws SQLException {
        try (Connection con = DBConnection.getConnection();
             Statement st = con.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM cricketers")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

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
}
