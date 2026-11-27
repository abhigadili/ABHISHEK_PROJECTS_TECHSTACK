package com.cricket.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Repository abstraction over the three MySQL user-defined functions (UDFs). */
public interface FunctionRepository {

    BigDecimal battingAverage(int runs, int matches);

    String playerGrade(int runs, int wickets, String role);

    String formatPlayerLabel(String name, String role, String team);

    /** Every cricketer row with all three UDFs applied inline in the SELECT. */
    List<Map<String, Object>> findAllPlayersWithComputedStats();
}
