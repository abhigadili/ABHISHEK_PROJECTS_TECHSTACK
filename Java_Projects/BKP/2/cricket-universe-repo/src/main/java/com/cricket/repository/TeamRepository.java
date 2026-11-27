package com.cricket.repository;

import com.cricket.model.Team;

import java.sql.SQLException;
import java.util.List;

/**
 * Team-specific repository contract.
 */
public interface TeamRepository extends Repository<Team, String> {

    /**
     * Filter teams by league.
     * @param leagueId  null = all leagues
     */
    List<Team> findByLeague(String leagueId) throws SQLException;
}
