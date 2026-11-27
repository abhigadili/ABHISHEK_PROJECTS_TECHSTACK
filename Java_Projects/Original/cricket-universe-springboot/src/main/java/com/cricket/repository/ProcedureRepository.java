package com.cricket.repository;

import java.util.List;
import java.util.Map;

/**
 * Repository abstraction over the eight MySQL stored procedures.
 * sp_analytics_demo and sp_window_functions_demo each return several result
 * sets in one call, so those two methods return a Map keyed by a readable
 * section name -> that section's rows, in the same order MySQL returns them.
 */
public interface ProcedureRepository {

    List<Map<String, Object>> listCountries(String search);

    List<Map<String, Object>> listLeagues(String countryId, String search);

    List<Map<String, Object>> listTeams(String leagueId);

    List<Map<String, Object>> listPlayers(String teamId, String role);

    List<Map<String, Object>> allPlayersDetail(String countryId, String role);

    List<Map<String, Object>> cursorRoleRunTotals();

    Map<String, List<Map<String, Object>>> windowFunctionsDemo();

    Map<String, List<Map<String, Object>>> analyticsDemo();
}
