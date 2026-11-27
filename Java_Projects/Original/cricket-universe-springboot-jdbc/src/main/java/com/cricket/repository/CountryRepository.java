package com.cricket.repository;

import com.cricket.model.Country;

import java.util.List;
import java.util.Optional;

/**
 * Repository Pattern contract for 'countries'. The Service layer only ever
 * sees this interface — never a Connection, Statement, or SQL string.
 */
public interface CountryRepository {

    List<Country> findAll();

    List<Country> search(String term);

    Optional<Country> findById(String id);

    boolean existsById(String id);

    Country insert(Country country);

    int update(Country country);

    int deleteById(String id);
}
