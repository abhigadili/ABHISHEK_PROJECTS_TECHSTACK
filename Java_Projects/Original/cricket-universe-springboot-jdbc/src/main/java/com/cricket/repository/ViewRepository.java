package com.cricket.repository;

import java.util.List;
import java.util.Map;

/**
 * Repository abstraction over the three MySQL views in cricket_universe.
 * Views have no stable single-column primary key to map a POJO to, so they
 * are read here as generic rows via JdbcTemplate.
 */
public interface ViewRepository {

    List<Map<String, Object>> findCountriesLeagues();

    List<Map<String, Object>> findTeamsPlayers();

    List<Map<String, Object>> findAllPlayersDetail();
}
