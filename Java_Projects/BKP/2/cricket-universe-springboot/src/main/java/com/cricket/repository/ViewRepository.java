package com.cricket.repository;

import java.util.List;
import java.util.Map;

/**
 * Repository abstraction over the three MySQL views in cricket_universe.
 * Views cannot be mapped as ordinary JPA entities (no stable single-column
 * primary key), so they are read here via JdbcTemplate instead — Services
 * and Controllers still depend only on this interface, never on JDBC.
 */
public interface ViewRepository {

    List<Map<String, Object>> findCountriesLeagues();

    List<Map<String, Object>> findTeamsPlayers();

    List<Map<String, Object>> findAllPlayersDetail();
}
