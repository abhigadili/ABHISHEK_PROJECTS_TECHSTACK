package com.cricket.demo;

import com.cricket.config.DBConnection;

import java.sql.*;

/**
 * Demonstrates querying the three database views:
 *   v_countries_leagues  — countries joined with leagues
 *   v_teams_players      — teams joined with cricketers
 *   v_all_players_detail — full hierarchy (cricketer→team→league→country)
 */
public class ViewDemo {

    public static void run() throws SQLException {
        System.out.println("\n════════════════════════════════════════════════════════");
        System.out.println("  VIEW DEMO");
        System.out.println("════════════════════════════════════════════════════════");

        viewCountriesLeagues();
        viewTeamsPlayers();
        viewAllPlayersDetail();
    }

    // ── VIEW 1: v_countries_leagues ──────────────────────────────────────────
    private static void viewCountriesLeagues() throws SQLException {
        System.out.println("\n  [v_countries_leagues] Countries with their leagues:");
        System.out.println("  " + "-".repeat(70));

        String sql = "SELECT country_name, short_name, league_name, league_format, board " +
                     "FROM v_countries_leagues ORDER BY country_name, league_name LIMIT 10";

        try (Connection con = DBConnection.getConnection();
             Statement  st  = con.createStatement();
             ResultSet  rs  = st.executeQuery(sql)) {

            System.out.printf("  %-15s %-5s %-35s %-12s %s%n",
                    "Country", "Code", "League", "Format", "Board");
            System.out.println("  " + "-".repeat(80));
            int count = 0;
            while (rs.next()) {
                System.out.printf("  %-15s %-5s %-35s %-12s %s%n",
                        rs.getString("country_name"),
                        rs.getString("short_name"),
                        rs.getString("league_name"),
                        rs.getString("league_format"),
                        rs.getString("board"));
                count++;
            }
            System.out.println("  (showing " + count + " of many rows)");
        }
    }

    // ── VIEW 2: v_teams_players ──────────────────────────────────────────────
    private static void viewTeamsPlayers() throws SQLException {
        System.out.println("\n  [v_teams_players] Teams with their players (IPL teams):");
        System.out.println("  " + "-".repeat(70));

        String sql = "SELECT team_name, player_name, player_role, runs, wickets " +
                     "FROM v_teams_players WHERE team_id IN ('mi','csk','rcb') " +
                     "ORDER BY team_name, runs DESC LIMIT 12";

        try (Connection con = DBConnection.getConnection();
             Statement  st  = con.createStatement();
             ResultSet  rs  = st.executeQuery(sql)) {

            System.out.printf("  %-28s %-30s %-22s %6s %7s%n",
                    "Team", "Player", "Role", "Runs", "Wickets");
            System.out.println("  " + "-".repeat(100));
            while (rs.next()) {
                System.out.printf("  %-28s %-30s %-22s %6d %7d%n",
                        rs.getString("team_name"),
                        rs.getString("player_name"),
                        rs.getString("player_role"),
                        rs.getInt   ("runs"),
                        rs.getInt   ("wickets"));
            }
        }
    }

    // ── VIEW 3: v_all_players_detail ─────────────────────────────────────────
    private static void viewAllPlayersDetail() throws SQLException {
        System.out.println("\n  [v_all_players_detail] Full player hierarchy (India, Batsmen):");
        System.out.println("  " + "-".repeat(70));

        String sql = "SELECT player_name, role, runs, team_name, league_name, country_name " +
                     "FROM v_all_players_detail " +
                     "WHERE country_id = 'ind' AND role = 'Batsman' " +
                     "ORDER BY runs DESC";

        try (Connection con = DBConnection.getConnection();
             Statement  st  = con.createStatement();
             ResultSet  rs  = st.executeQuery(sql)) {

            System.out.printf("  %-30s %-10s %6s  %-25s %-30s %s%n",
                    "Player", "Role", "Runs", "Team", "League", "Country");
            System.out.println("  " + "-".repeat(115));
            while (rs.next()) {
                System.out.printf("  %-30s %-10s %6d  %-25s %-30s %s%n",
                        rs.getString("player_name"),
                        rs.getString("role"),
                        rs.getInt   ("runs"),
                        rs.getString("team_name"),
                        rs.getString("league_name"),
                        rs.getString("country_name"));
            }
        }
    }
}
