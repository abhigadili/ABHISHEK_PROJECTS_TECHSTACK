package com.cricket.repository.impl;

import com.cricket.config.DBConnection;
import com.cricket.model.Team;
import com.cricket.repository.TeamRepository;

import java.sql.*;
import java.util.*;

public class JdbcTeamRepository implements TeamRepository {

    private static final String SELECT_BASE =
        "SELECT t.id, t.league_id, l.name AS league_name, t.name, t.captain, " +
        "t.coach, t.home_ground, COALESCE(t.titles,0) AS titles " +
        "FROM teams t JOIN leagues l ON l.id = t.league_id";

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

    @Override
    public List<Team> findAll() throws SQLException {
        List<Team> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " ORDER BY l.name, t.name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    @Override
    public Optional<Team> findById(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(SELECT_BASE + " WHERE t.id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public List<Team> findByLeague(String leagueId) throws SQLException {
        boolean filter = leagueId != null && !leagueId.isBlank();
        String sql = SELECT_BASE + (filter ? " WHERE t.league_id = ?" : "") + " ORDER BY l.name, t.name";
        List<Team> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            if (filter) ps.setString(1, leagueId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapRow(rs));
            }
        }
        return list;
    }

    @Override
    public Team save(Team t) throws SQLException {
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
            ps.executeUpdate();
        }
        return t;
    }

    @Override
    public Optional<Team> update(String id, Team t) throws SQLException {
        String sql = "UPDATE teams SET name=?, captain=?, coach=?, home_ground=?, titles=? WHERE id=?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, t.getName());
            ps.setString(2, t.getCaptain());
            ps.setString(3, t.getCoach());
            ps.setString(4, t.getHomeGround());
            ps.setInt   (5, t.getTitles());
            ps.setString(6, id);
            return ps.executeUpdate() > 0 ? findById(id) : Optional.empty();
        }
    }

    @Override
    public boolean delete(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("DELETE FROM teams WHERE id = ?")) {
            ps.setString(1, id);
            return ps.executeUpdate() > 0;
        }
    }
}
