package com.cricket.demo;

import com.cricket.config.DBConnection;

import java.sql.*;

/**
 * Demonstrates calling all stored procedures using CallableStatement:
 *   sp_list_countries       — list with search filter
 *   sp_list_leagues         — list by country
 *   sp_list_teams           — list by league
 *   sp_list_players         — list by team + role
 *   sp_all_players_detail   — full hierarchy (cursor internally)
 *   sp_cursor_role_run_totals — cursor-based aggregation
 *   sp_window_functions_demo  — window functions result set
 *   sp_analytics_demo         — analytics / aggregates result set
 */
public class ProcedureDemo {

    public static void run() throws SQLException {
        System.out.println("\n════════════════════════════════════════════════════════");
        System.out.println("  STORED PROCEDURE DEMO");
        System.out.println("════════════════════════════════════════════════════════");

        callListCountries("ind");
        callListLeagues("ind", "");
        callListTeams("ipl");
        callListPlayers("mi", "");
        callAllPlayersDetail("ind", "Bowler");
        callCursorRoleRunTotals();
        callWindowFunctionsDemo();
        callAnalyticsDemo();
    }

    // ── sp_list_countries ────────────────────────────────────────────────────
    private static void callListCountries(String search) throws SQLException {
        System.out.println("\n  [sp_list_countries('" + search + "')]");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_list_countries(?)}")) {
            cs.setString(1, search);
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-6s %-25s %-5s %-30s %s%n","ID","Name","Code","Board","WorldCups");
                    System.out.println("  " + "-".repeat(75));
                    while (rs.next()) {
                        System.out.printf("  %-6s %-25s %-5s %-30s %d%n",
                                rs.getString("id"), rs.getString("name"),
                                rs.getString("short_name"), rs.getString("board"),
                                rs.getInt("world_cups_won"));
                    }
                }
            }
        }
    }

    // ── sp_list_leagues ──────────────────────────────────────────────────────
    private static void callListLeagues(String countryId, String search) throws SQLException {
        System.out.println("\n  [sp_list_leagues('" + countryId + "', '" + search + "')]");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_list_leagues(?, ?)}")) {
            cs.setString(1, countryId);
            cs.setString(2, search);
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-30s %-15s %-12s %s%n","League","Country","Format","Year");
                    System.out.println("  " + "-".repeat(65));
                    while (rs.next()) {
                        System.out.printf("  %-30s %-15s %-12s %d%n",
                                rs.getString("name"), rs.getString("country_name"),
                                rs.getString("format"), rs.getInt("established"));
                    }
                }
            }
        }
    }

    // ── sp_list_teams ────────────────────────────────────────────────────────
    private static void callListTeams(String leagueId) throws SQLException {
        System.out.println("\n  [sp_list_teams('" + leagueId + "')]");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_list_teams(?)}")) {
            cs.setString(1, leagueId);
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-30s %-20s %7s  %s%n","Team","Captain","Titles","League");
                    System.out.println("  " + "-".repeat(75));
                    while (rs.next()) {
                        System.out.printf("  %-30s %-20s %7d  %s%n",
                                rs.getString("name"), rs.getString("captain"),
                                rs.getInt("titles"), rs.getString("league_name"));
                    }
                }
            }
        }
    }

    // ── sp_list_players ──────────────────────────────────────────────────────
    private static void callListPlayers(String teamId, String role) throws SQLException {
        System.out.println("\n  [sp_list_players('" + teamId + "', '" + role + "')]");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_list_players(?, ?)}")) {
            cs.setString(1, teamId);
            cs.setString(2, role);
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-30s %-22s %6s %7s%n","Player","Role","Runs","Wickets");
                    System.out.println("  " + "-".repeat(70));
                    while (rs.next()) {
                        System.out.printf("  %-30s %-22s %6d %7d%n",
                                rs.getString("name"), rs.getString("role"),
                                rs.getInt("runs"), rs.getInt("wickets"));
                    }
                }
            }
        }
    }

    // ── sp_all_players_detail ────────────────────────────────────────────────
    private static void callAllPlayersDetail(String countryId, String role) throws SQLException {
        System.out.println("\n  [sp_all_players_detail('" + countryId + "', '" + role + "')]");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_all_players_detail(?, ?)}")) {
            cs.setString(1, countryId);
            cs.setString(2, role);
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-28s %-10s %6s %6s  %-20s %-25s %s%n",
                            "Player","Role","Runs","Wkts","Team","League","Country");
                    System.out.println("  " + "-".repeat(110));
                    while (rs.next()) {
                        System.out.printf("  %-28s %-10s %6d %6d  %-20s %-25s %s%n",
                                rs.getString("player_name"), rs.getString("role"),
                                rs.getInt("runs"), rs.getInt("wickets"),
                                rs.getString("team_name"), rs.getString("league_name"),
                                rs.getString("country_name"));
                    }
                }
            }
        }
    }

    // ── sp_cursor_role_run_totals ────────────────────────────────────────────
    private static void callCursorRoleRunTotals() throws SQLException {
        System.out.println("\n  [sp_cursor_role_run_totals()] — Cursor-based aggregation:");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_cursor_role_run_totals()}")) {
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-25s %12s %12s %10s%n",
                            "Role","TotalRuns","PlayerCount","AvgRuns");
                    System.out.println("  " + "-".repeat(65));
                    while (rs.next()) {
                        System.out.printf("  %-25s %12d %12d %10.2f%n",
                                rs.getString("role"),
                                rs.getLong  ("total_runs"),
                                rs.getInt   ("player_count"),
                                rs.getDouble("avg_runs"));
                    }
                }
            }
        }
    }

    // ── sp_window_functions_demo ─────────────────────────────────────────────
    private static void callWindowFunctionsDemo() throws SQLException {
        System.out.println("\n  [sp_window_functions_demo()] — RANK / NTILE / LAG / LEAD (first result set):");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_window_functions_demo()}")) {
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-30s %-25s %6s %8s %12s %8s%n",
                            "Player","Team","Runs","Rank","DenseRank","RowNum");
                    System.out.println("  " + "-".repeat(95));
                    int rows = 0;
                    while (rs.next() && rows < 10) {
                        System.out.printf("  %-30s %-25s %6d %8d %12d %8d%n",
                                rs.getString("name"), rs.getString("team"),
                                rs.getInt("runs"), rs.getInt("run_rank"),
                                rs.getInt("run_dense_rank"), rs.getInt("row_num"));
                        rows++;
                    }
                    System.out.println("  (showing first 10 rows)");
                }
            }
        }
    }

    // ── sp_analytics_demo ────────────────────────────────────────────────────
    private static void callAnalyticsDemo() throws SQLException {
        System.out.println("\n  [sp_analytics_demo()] — Aggregates per role (first result set):");
        try (Connection con = DBConnection.getConnection();
             CallableStatement cs = con.prepareCall("{CALL sp_analytics_demo()}")) {
            boolean hasRs = cs.execute();
            if (hasRs) {
                try (ResultSet rs = cs.getResultSet()) {
                    System.out.printf("  %-25s %6s %10s %8s %8s %8s%n",
                            "Role","Count","TotalRuns","MaxRuns","AvgRuns","TotalWkts");
                    System.out.println("  " + "-".repeat(75));
                    while (rs.next()) {
                        System.out.printf("  %-25s %6d %10d %8d %8.2f %8d%n",
                                rs.getString("role"),
                                rs.getInt   ("player_count"),
                                rs.getLong  ("total_runs"),
                                rs.getInt   ("highest_score"),
                                rs.getDouble("avg_runs"),
                                rs.getLong  ("total_wickets"));
                    }
                }
            }
        }
    }
}
