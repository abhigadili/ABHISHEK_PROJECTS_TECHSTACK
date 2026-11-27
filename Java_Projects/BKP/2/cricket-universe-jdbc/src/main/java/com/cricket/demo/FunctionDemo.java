package com.cricket.demo;

import com.cricket.config.DBConnection;

import java.sql.*;

/**
 * Demonstrates calling MySQL user-defined functions via JDBC:
 *   fn_batting_average(runs, matches)            — decimal batting average
 *   fn_player_grade(runs, wickets, role)         — grade label
 *   fn_format_player_label(name, role, team)     — formatted display string
 *
 * Functions are called inline in SQL SELECT statements.
 */
public class FunctionDemo {

    public static void run() throws SQLException {
        System.out.println("\n════════════════════════════════════════════════════════");
        System.out.println("  MYSQL FUNCTION DEMO");
        System.out.println("════════════════════════════════════════════════════════");

        callBattingAverage();
        callPlayerGrade();
        callFormatLabel();
    }

    // ── fn_batting_average ───────────────────────────────────────────────────
    private static void callBattingAverage() throws SQLException {
        System.out.println("\n  [fn_batting_average(runs, matches)] — Batting average per player:");

        String sql = "SELECT cr.name, cr.runs, cr.matches, " +
                     "fn_batting_average(cr.runs, cr.matches) AS batting_avg " +
                     "FROM cricketers cr WHERE cr.matches > 0 " +
                     "ORDER BY batting_avg DESC LIMIT 10";

        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {

            System.out.printf("  %-30s %8s %8s %12s%n", "Player", "Runs", "Matches", "BattingAvg");
            System.out.println("  " + "-".repeat(62));
            while (rs.next()) {
                System.out.printf("  %-30s %8d %8d %12.2f%n",
                        rs.getString("name"),
                        rs.getInt   ("runs"),
                        rs.getInt   ("matches"),
                        rs.getDouble("batting_avg"));
            }
        }
    }

    // ── fn_player_grade ──────────────────────────────────────────────────────
    private static void callPlayerGrade() throws SQLException {
        System.out.println("\n  [fn_player_grade(runs, wickets, role)] — Performance grade:");

        String sql = "SELECT cr.name, cr.role, cr.runs, cr.wickets, " +
                     "fn_player_grade(cr.runs, cr.wickets, cr.role) AS grade " +
                     "FROM cricketers cr " +
                     "ORDER BY cr.runs DESC LIMIT 12";

        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {

            System.out.printf("  %-30s %-22s %7s %7s  %s%n",
                    "Player", "Role", "Runs", "Wickets", "Grade");
            System.out.println("  " + "-".repeat(85));
            while (rs.next()) {
                System.out.printf("  %-30s %-22s %7d %7d  %s%n",
                        rs.getString("name"),
                        rs.getString("role"),
                        rs.getInt   ("runs"),
                        rs.getInt   ("wickets"),
                        rs.getString("grade"));
            }
        }
    }

    // ── fn_format_player_label ───────────────────────────────────────────────
    private static void callFormatLabel() throws SQLException {
        System.out.println("\n  [fn_format_player_label(name, role, team)] — Formatted labels:");

        String sql = "SELECT fn_format_player_label(cr.name, cr.role, t.name) AS player_label, " +
                     "cr.runs " +
                     "FROM cricketers cr JOIN teams t ON t.id = cr.team_id " +
                     "ORDER BY cr.runs DESC LIMIT 8";

        try (Connection con = DBConnection.getConnection();
             Statement st   = con.createStatement();
             ResultSet rs   = st.executeQuery(sql)) {

            System.out.println("  " + "-".repeat(70));
            while (rs.next()) {
                System.out.printf("  %s  (Runs: %d)%n",
                        rs.getString("player_label"),
                        rs.getInt   ("runs"));
            }
        }
    }
}
