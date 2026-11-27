package com.cricket.repository;

import com.cricket.model.League;

import java.sql.SQLException;
import java.util.List;

/**
 * League-specific repository contract.
 */
public interface LeagueRepository extends Repository<League, String> {

    /**
     * Filter leagues by country and/or name keyword.
     * @param countryId  null = all countries
     * @param keyword    null = no name filter
     */
    List<League> findByCountry(String countryId, String keyword) throws SQLException;
}
