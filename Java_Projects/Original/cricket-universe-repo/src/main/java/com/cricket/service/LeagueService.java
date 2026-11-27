package com.cricket.service;

import com.cricket.model.League;
import com.cricket.repository.LeagueRepository;
import com.cricket.repository.impl.JdbcLeagueRepository;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public class LeagueService {

    private final LeagueRepository repo;

    public LeagueService() { this.repo = new JdbcLeagueRepository(); }
    public LeagueService(LeagueRepository repo) { this.repo = repo; }

    public List<League> getAll() throws SQLException { return repo.findAll(); }

    public List<League> getByCountry(String countryId, String keyword) throws SQLException {
        return repo.findByCountry(countryId, keyword);
    }

    public Optional<League> getById(String id) throws SQLException { return repo.findById(id); }

    public League create(League l) throws SQLException {
        if (l.getId()        == null || l.getId().isBlank())        throw new IllegalArgumentException("League id is required");
        if (l.getName()      == null || l.getName().isBlank())      throw new IllegalArgumentException("League name is required");
        if (l.getCountryId() == null || l.getCountryId().isBlank()) throw new IllegalArgumentException("League countryId is required");
        return repo.save(l);
    }

    public Optional<League> update(String id, League l) throws SQLException {
        if (l.getName() == null || l.getName().isBlank()) throw new IllegalArgumentException("League name is required");
        return repo.update(id, l);
    }

    public boolean delete(String id) throws SQLException { return repo.delete(id); }
}
