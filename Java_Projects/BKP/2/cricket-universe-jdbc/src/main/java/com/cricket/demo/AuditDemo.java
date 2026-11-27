package com.cricket.demo;

import com.cricket.config.DBConnection;

import java.sql.*;

/**
 * Demonstrates audit tables and triggers.
 * Performs INSERT / UPDATE / DELETE on cricketers
 * then reads the auto-generated audit_cricketers rows.
 */
public class AuditDemo {

    private static final String TEST_ID = "jdbc-test-player-99";

    public static void run() throws SQLException {
        System.out.println("\n════════════════════════════════════════════════════════");
        System.out.println("  AUDIT TABLE & TRIGGER DEMO");
        System.out.println("════════════════════════════════════════════════════════");

        insertTestPlayer();
        updateTestPlayer();
        deleteTestPlayer();
        showAuditEntries();
        cleanupAudit();
    }

    private static void insertTestPlayer() throws SQLException {
        System.out.println("\n  Step 1 — INSERT a test cricketer (trigger fires automatically)...");
        String sql = "INSERT INTO cricketers (id, team_id, name, role, batting_style, matches, runs, wickets) " +
                     "VALUES (?, 'mi', 'JDBC Test Player', 'Batsman', 'Right-handed', 10, 350, 0)";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, TEST_ID);
            ps.executeUpdate();
            System.out.println("  INSERT executed — audit_cricketers should have an INSERT row.");
        }
    }

    private static void updateTestPlayer() throws SQLException {
        System.out.println("  Step 2 — UPDATE runs to 500 (trigger fires automatically)...");
        String sql = "UPDATE cricketers SET runs = 500, matches = 15 WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, TEST_ID);
            ps.executeUpdate();
            System.out.println("  UPDATE executed — audit_cricketers should have an UPDATE row.");
        }
    }

    private static void deleteTestPlayer() throws SQLException {
        System.out.println("  Step 3 — DELETE the test cricketer (trigger fires automatically)...");
        String sql = "DELETE FROM cricketers WHERE id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, TEST_ID);
            ps.executeUpdate();
            System.out.println("  DELETE executed — audit_cricketers should have a DELETE row.");
        }
    }

    private static void showAuditEntries() throws SQLException {
        System.out.println("\n  Audit log for record '" + TEST_ID + "':");
        String sql = "SELECT audit_id, operation, record_id, old_name, new_name, " +
                     "old_runs, new_runs, changed_at " +
                     "FROM audit_cricketers WHERE record_id = ? ORDER BY audit_id";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, TEST_ID);
            try (ResultSet rs = ps.executeQuery()) {
                System.out.printf("  %-8s %-8s %-28s %-20s %-20s %-8s %-8s  %s%n",
                        "AuditID","Op","RecordID","OldName","NewName","OldRuns","NewRuns","ChangedAt");
                System.out.println("  " + "-".repeat(115));
                while (rs.next()) {
                    System.out.printf("  %-8d %-8s %-28s %-20s %-20s %-8s %-8s  %s%n",
                            rs.getInt   ("audit_id"),
                            rs.getString("operation"),
                            rs.getString("record_id"),
                            rs.getString("old_name")  != null ? rs.getString("old_name")  : "-",
                            rs.getString("new_name")  != null ? rs.getString("new_name")  : "-",
                            rs.getObject("old_runs")  != null ? rs.getInt("old_runs")  + "" : "-",
                            rs.getObject("new_runs")  != null ? rs.getInt("new_runs")  + "" : "-",
                            rs.getTimestamp("changed_at"));
                }
            }
        }
    }

    private static void cleanupAudit() throws SQLException {
        System.out.println("\n  Cleaning up test audit rows...");
        String sql = "DELETE FROM audit_cricketers WHERE record_id = ?";
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, TEST_ID);
            int deleted = ps.executeUpdate();
            System.out.println("  Removed " + deleted + " audit row(s).");
        }
    }
}
