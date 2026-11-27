package com.cricket.dao;

import com.cricket.config.DBConnection;
import com.cricket.model.Team;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * DAO for the teams table.
 */
public class TeamDAO {

    public List<Team> findAll() throws SQLException {
        List<Team> list = new ArrayList<>();
        String sql = "SELECT t.id, t.league_id, l.name AS league_name, t.name, t.captain, " +
                     "t.coach, t.home_ground, COALESCE(t.titles, 0) AS titles " +
                     "FROM teams t JOIN leagues l ON l.id = t.league_id ORDER BY l.name, t.name";
        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    public List<Team> findByLeague(String leagueId) throws SQLException {
        List<Team> list = new ArrayList<>();
        String sql = "SELECT t.id, t.league_id, l.name AS league_name, t.name, t.captain, " +
                     "t.coach, t.home_ground, COALESCE(t.titles, 0) AS titles " +
                     "FROM teams t JOIN leagues l ON l.id = t.league_id " +
                     "WHERE t.league_id = ? ORDER BY t.name";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, leagueId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    public boolean insert(Team t) throws SQLException {
        String sql = "INSERT INTO teams (id, league_id, name, captain, coach, home_ground, titles) VALUES (?,?,?,?,?,?,?)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, t.getId());
            ps.setString(2, t.getLeagueId());
            ps.setString(3, t.getName());
            ps.setString(4, t.getCaptain());
            ps.setString(5, t.getCoach());
            ps.setString(6, t.getHomeGround());
            ps.setInt   (7, t.getTitles());
            return ps.executeUpdate() > 0;
        }
    }

    public boolean update(Team t) throws SQLException {
        String sql = "UPDATE teams SET name=?, captain=?, coach=?, home_ground=?, titles=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, t.getName());
            ps.setString(2, t.getCaptain());
            ps.setString(3, t.getCoach());
            ps.setString(4, t.getHomeGround());
            ps.setInt   (5, t.getTitles());
            ps.setString(6, t.getId());
            return ps.executeUpdate() > 0;
        }
    }

    public boolean delete(String id) throws SQLException {
        String sql = "DELETE FROM teams WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public int count() throws SQLException {
        try (Connection con = DBConnection.getConnection();
             Statement st = con.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM teams")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private Team mapRow(ResultSet rs) throws SQLException {
        Team t = new Team();
        t.setId        (rs.getString("id"));
        t.setLeagueId  (rs.getString("league_id"));
        t.setLeagueName(rs.getString("league_name"));
        t.setName      (rs.getString("name"));
        t.setCaptain   (rs.getString("captain"));
        t.setCoach     (rs.getString("coach"));
        t.setHomeGround(rs.getString("home_ground"));
        t.setTitles    (rs.getInt   ("titles"));
        return t;
    }
}
