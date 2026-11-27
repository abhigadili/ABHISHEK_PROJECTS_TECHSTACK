package com.cricket.repository;

import com.cricket.model.Country;

import java.sql.SQLException;
import java.util.List;

/**
 * Country-specific repository contract.
 * Extends the generic Repository and adds a domain query: search by keyword.
 */
public interface CountryRepository extends Repository<Country, String> {

    /**
     * Full-text search across name, short_name and board.
     * @param keyword  search term; null or blank returns all rows
     */
    List<Country> search(String keyword) throws SQLException;
}
