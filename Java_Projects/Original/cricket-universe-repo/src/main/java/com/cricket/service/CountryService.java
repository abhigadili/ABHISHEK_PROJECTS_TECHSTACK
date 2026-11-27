package com.cricket.service;

import com.cricket.model.Country;
import com.cricket.repository.CountryRepository;
import com.cricket.repository.impl.JdbcCountryRepository;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Service layer for countries.
 *
 * Servlets talk to this class, never to the repository directly.
 * The repository field is typed as the interface — the JDBC implementation
 * detail is wired here once and hidden from all callers above.
 *
 * Business rules (validation) live here, not in the servlet or repository.
 */
public class CountryService {

    private final CountryRepository repo;

    public CountryService() {
        this.repo = new JdbcCountryRepository();
    }

    /** For testing — inject any CountryRepository implementation. */
    public CountryService(CountryRepository repo) {
        this.repo = repo;
    }

    public List<Country> getAll() throws SQLException {
        return repo.findAll();
    }

    public List<Country> search(String keyword) throws SQLException {
        return repo.search(keyword);
    }

    public Optional<Country> getById(String id) throws SQLException {
        return repo.findById(id);
    }

    public Country create(Country c) throws SQLException {
        if (c.getId() == null || c.getId().isBlank())
            throw new IllegalArgumentException("Country id is required");
        if (c.getName() == null || c.getName().isBlank())
            throw new IllegalArgumentException("Country name is required");
        return repo.save(c);
    }

    public Optional<Country> update(String id, Country c) throws SQLException {
        if (c.getName() == null || c.getName().isBlank())
            throw new IllegalArgumentException("Country name is required");
        return repo.update(id, c);
    }

    public boolean delete(String id) throws SQLException {
        return repo.delete(id);
    }
}
