package com.cricket.service;

import com.cricket.model.Cricketer;
import com.cricket.repository.CricketerRepository;
import com.cricket.repository.impl.JdbcCricketerRepository;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

public class CricketerService {

    private final CricketerRepository repo;

    public CricketerService() { this.repo = new JdbcCricketerRepository(); }
    public CricketerService(CricketerRepository repo) { this.repo = repo; }

    public List<Cricketer> getAll() throws SQLException { return repo.findAll(); }

    public List<Cricketer> getByTeamAndRole(String teamId, String role) throws SQLException {
        return repo.findByTeamAndRole(teamId, role);
    }

    public Optional<Cricketer> getById(String id) throws SQLException { return repo.findById(id); }

    public Cricketer create(Cricketer cr) throws SQLException {
        if (cr.getId()     == null || cr.getId().isBlank())     throw new IllegalArgumentException("Cricketer id is required");
        if (cr.getName()   == null || cr.getName().isBlank())   throw new IllegalArgumentException("Cricketer name is required");
        if (cr.getTeamId() == null || cr.getTeamId().isBlank()) throw new IllegalArgumentException("Cricketer teamId is required");
        return repo.save(cr);
    }

    public Optional<Cricketer> update(String id, Cricketer cr) throws SQLException {
        if (cr.getName() == null || cr.getName().isBlank()) throw new IllegalArgumentException("Cricketer name is required");
        return repo.update(id, cr);
    }

    public boolean delete(String id) throws SQLException { return repo.delete(id); }
}
