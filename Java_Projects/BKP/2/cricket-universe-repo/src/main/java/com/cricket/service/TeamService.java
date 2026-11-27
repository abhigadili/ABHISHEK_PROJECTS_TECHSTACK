package com.cricket.service;

import com.cricket.model.Team;
import com.cricket.repository.TeamRepository;
import com.cricket.repository.impl.JdbcTeamRepository;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public class TeamService {

    private final TeamRepository repo;

    public TeamService() { this.repo = new JdbcTeamRepository(); }
    public TeamService(TeamRepository repo) { this.repo = repo; }

    public List<Team> getAll() throws SQLException { return repo.findAll(); }

    public List<Team> getByLeague(String leagueId) throws SQLException {
        return repo.findByLeague(leagueId);
    }

    public Optional<Team> getById(String id) throws SQLException { return repo.findById(id); }

    public Team create(Team t) throws SQLException {
        if (t.getId()       == null || t.getId().isBlank())       throw new IllegalArgumentException("Team id is required");
        if (t.getName()     == null || t.getName().isBlank())     throw new IllegalArgumentException("Team name is required");
        if (t.getLeagueId() == null || t.getLeagueId().isBlank()) throw new IllegalArgumentException("Team leagueId is required");
        return repo.save(t);
    }

    public Optional<Team> update(String id, Team t) throws SQLException {
        if (t.getName() == null || t.getName().isBlank()) throw new IllegalArgumentException("Team name is required");
        return repo.update(id, t);
    }

    public boolean delete(String id) throws SQLException { return repo.delete(id); }
}
