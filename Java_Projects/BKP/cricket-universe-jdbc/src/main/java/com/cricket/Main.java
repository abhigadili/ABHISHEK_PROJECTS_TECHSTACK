package com.cricket;

import com.cricket.config.DBConnection;
import com.cricket.dao.*;
import com.cricket.demo.*;
import com.cricket.model.*;

import java.sql.SQLException;
import java.util.List;

/**
 * Cricket Universe JDBC Application — Entry Point
 *
 * Demonstrates:
 *  - Direct table CRUD via DAO classes (PreparedStatement)
 *  - Views  : v_countries_leagues, v_teams_players, v_all_players_detail
 *  - Stored procedures : sp_list_*, sp_all_players_detail,
 *                        sp_cursor_role_run_totals, sp_window_functions_demo,
 *                        sp_analytics_demo
 *  - User-defined functions : fn_batting_average, fn_player_grade, fn_format_player_label
 *  - Audit triggers : INSERT/UPDATE/DELETE on cricketers → audit_cricketers
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("╔══════════════════════════════════════════════════════════╗");
        System.out.println("║   Cricket Universe Explorer — JDBC Demo Application      ║");
        System.out.println("║   Database: cricket_universe @ localhost:3306            ║");
        System.out.println("╚══════════════════════════════════════════════════════════╝");

        try {
            // ── 1. DIRECT TABLE CRUD ─────────────────────────────────────────
            runDirectTableDemo();

            // ── 2. VIEWS ─────────────────────────────────────────────────────
            ViewDemo.run();

            // ── 3. STORED PROCEDURES ─────────────────────────────────────────
            ProcedureDemo.run();

            // ── 4. USER-DEFINED FUNCTIONS ─────────────────────────────────────
            FunctionDemo.run();

            // ── 5. AUDIT TABLES + TRIGGERS ────────────────────────────────────
            AuditDemo.run();

            System.out.println("\n════════════════════════════════════════════════════════");
            System.out.println("  All demos completed successfully.");
            System.out.println("════════════════════════════════════════════════════════\n");

        } catch (SQLException e) {
            System.err.println("\n[ERROR] SQL Exception: " + e.getMessage());
            System.err.println("  SQLState : " + e.getSQLState());
            System.err.println("  ErrorCode: " + e.getErrorCode());
            e.printStackTrace();
        } finally {
            DBConnection.closeConnection();
        }
    }

    // ── DIRECT TABLE CRUD DEMO ────────────────────────────────────────────────
    private static void runDirectTableDemo() throws SQLException {
        System.out.println("\n════════════════════════════════════════════════════════");
        System.out.println("  DIRECT TABLE CRUD DEMO (PreparedStatement / Statement)");
        System.out.println("════════════════════════════════════════════════════════");

        CountryDAO  countryDAO  = new CountryDAO();
        LeagueDAO   leagueDAO   = new LeagueDAO();
        TeamDAO     teamDAO     = new TeamDAO();
        CricketerDAO cricDAO    = new CricketerDAO();

        // ── Database summary ─────────────────────────────────────────────────
        System.out.println("\n  Database row counts:");
        System.out.println("  Countries  : " + countryDAO.count());
        System.out.println("  Leagues    : " + leagueDAO.count());
        System.out.println("  Teams      : " + teamDAO.count());
        System.out.println("  Cricketers : " + cricDAO.count());

        // ── Countries: findAll ───────────────────────────────────────────────
        System.out.println("\n  All countries:");
        System.out.println("  " + "-".repeat(80));
        List<Country> countries = countryDAO.findAll();
        countries.forEach(c -> System.out.println("  " + c));

        // ── Countries: findById ──────────────────────────────────────────────
        System.out.println("\n  findById('ind'):");
        Country india = countryDAO.findById("ind");
        if (india != null) System.out.println("  " + india);

        // ── Countries: search ────────────────────────────────────────────────
        System.out.println("\n  search('BCCI'):");
        countryDAO.search("BCCI").forEach(c -> System.out.println("  " + c));

        // ── Leagues by country ───────────────────────────────────────────────
        System.out.println("\n  Leagues for India (findByCountry):");
        System.out.println("  " + "-".repeat(80));
        leagueDAO.findByCountry("ind").forEach(l -> System.out.println("  " + l));

        // ── Teams by league ──────────────────────────────────────────────────
        System.out.println("\n  IPL Teams (findByLeague):");
        System.out.println("  " + "-".repeat(80));
        teamDAO.findByLeague("ipl").forEach(t -> System.out.println("  " + t));

        // ── Cricketers: by role ──────────────────────────────────────────────
        System.out.println("\n  Top Batsmen (findByRole):");
        System.out.println("  " + "-".repeat(80));
        cricDAO.findByRole("Batsman").stream().limit(5).forEach(c -> System.out.println("  " + c));

        // ── INSERT → UPDATE → DELETE lifecycle (test country) ────────────────
        System.out.println("\n  CRUD lifecycle — INSERT → UPDATE → DELETE:");
        Country testCountry = new Country(
                "test-jdbc", "TestLand", "TST", "🏏",
                "Test Board", "Test Captain", "Test Coach", 0, 2024);

        boolean inserted = countryDAO.insert(testCountry);
        System.out.println("  INSERT  success: " + inserted);

        testCountry.setWorldCupsWon(1);
        testCountry.setCaptain("New Captain");
        boolean updated = countryDAO.update(testCountry);
        System.out.println("  UPDATE  success: " + updated
                + " (worldCupsWon → 1, captain → 'New Captain')");

        // Read back to confirm
        Country readBack = countryDAO.findById("test-jdbc");
        if (readBack != null) {
            System.out.println("  Read back: " + readBack);
        }

        boolean deleted = countryDAO.delete("test-jdbc");
        System.out.println("  DELETE  success: " + deleted);
        System.out.println("  Total countries after delete: " + countryDAO.count());
    }
}
