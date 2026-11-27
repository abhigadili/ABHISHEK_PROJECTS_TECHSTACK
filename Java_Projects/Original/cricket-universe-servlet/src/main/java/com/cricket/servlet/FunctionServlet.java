package com.cricket.servlet;

import com.cricket.config.DBConnection;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.*;
import java.util.*;

/**
 * Demonstrates calling MySQL UDFs inline from a SELECT statement.
 *
 * GET /api/functions/batting-average   ?runs=  &matches=
 * GET /api/functions/player-grade      ?runs=  &wickets= &role=
 * GET /api/functions/player-label      ?name=  &role=    &team=
 * GET /api/functions/all-players       → applies all three UDFs to every cricketer row
 */
@WebServlet(urlPatterns = "/api/functions/*")
public class FunctionServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (path == null || path.equals("/")) {
            sendError(res, 400, "Specify a function path: " +
                "batting-average | player-grade | player-label | all-players");
            return;
        }

        try (Connection con = DBConnection.getConnection()) {
            switch (path) {

                // fn_batting_average(runs, matches) — scalar result
                case "/batting-average" -> {
                    int runs    = parseIntParam(req, "runs",    0);
                    int matches = parseIntParam(req, "matches", 1);  // avoid division by zero
                    String sql = "SELECT fn_batting_average(?, ?) AS batting_average";
                    try (PreparedStatement ps = con.prepareStatement(sql)) {
                        ps.setInt(1, runs);
                        ps.setInt(2, matches);
                        try (ResultSet rs = ps.executeQuery()) {
                            Map<String, Object> result = new LinkedHashMap<>();
                            if (rs.next()) result.put("batting_average", rs.getObject("batting_average"));
                            result.put("inputs", Map.of("runs", runs, "matches", matches));
                            sendSuccess(res, result);
                        }
                    }
                }

                // fn_player_grade(runs, wickets, role) — scalar result
                case "/player-grade" -> {
                    int    runs    = parseIntParam(req, "runs",    0);
                    int    wickets = parseIntParam(req, "wickets", 0);
                    String role    = req.getParameter("role") != null ? req.getParameter("role") : "Batsman";
                    String sql = "SELECT fn_player_grade(?, ?, ?) AS player_grade";
                    try (PreparedStatement ps = con.prepareStatement(sql)) {
                        ps.setInt   (1, runs);
                        ps.setInt   (2, wickets);
                        ps.setString(3, role);
                        try (ResultSet rs = ps.executeQuery()) {
                            Map<String, Object> result = new LinkedHashMap<>();
                            if (rs.next()) result.put("player_grade", rs.getObject("player_grade"));
                            result.put("inputs", Map.of("runs", runs, "wickets", wickets, "role", role));
                            sendSuccess(res, result);
                        }
                    }
                }

                // fn_format_player_label(name, role, team) — scalar result
                case "/player-label" -> {
                    String name = req.getParameter("name") != null ? req.getParameter("name") : "Unknown";
                    String role = req.getParameter("role") != null ? req.getParameter("role") : "Batsman";
                    String team = req.getParameter("team") != null ? req.getParameter("team") : "Unknown Team";
                    String sql = "SELECT fn_format_player_label(?, ?, ?) AS player_label";
                    try (PreparedStatement ps = con.prepareStatement(sql)) {
                        ps.setString(1, name);
                        ps.setString(2, role);
                        ps.setString(3, team);
                        try (ResultSet rs = ps.executeQuery()) {
                            Map<String, Object> result = new LinkedHashMap<>();
                            if (rs.next()) result.put("player_label", rs.getObject("player_label"));
                            result.put("inputs", Map.of("name", name, "role", role, "team", team));
                            sendSuccess(res, result);
                        }
                    }
                }

                // Apply all three UDFs to every cricketer in the database
                case "/all-players" -> {
                    String sql =
                        "SELECT cr.id, cr.name, cr.role, t.name AS team_name, " +
                        "       COALESCE(cr.runs,0) AS runs, COALESCE(cr.wickets,0) AS wickets, " +
                        "       COALESCE(cr.matches,0) AS matches, " +
                        "       fn_batting_average(COALESCE(cr.runs,0), GREATEST(COALESCE(cr.matches,1),1)) AS batting_average, " +
                        "       fn_player_grade(COALESCE(cr.runs,0), COALESCE(cr.wickets,0), cr.role)       AS player_grade, " +
                        "       fn_format_player_label(cr.name, cr.role, t.name)                             AS player_label " +
                        "FROM cricketers cr JOIN teams t ON t.id = cr.team_id " +
                        "ORDER BY cr.name";

                    try (PreparedStatement ps = con.prepareStatement(sql);
                         ResultSet rs = ps.executeQuery()) {

                        ResultSetMetaData meta = rs.getMetaData();
                        int cols = meta.getColumnCount();
                        List<Map<String, Object>> rows = new ArrayList<>();
                        while (rs.next()) {
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (int i = 1; i <= cols; i++) row.put(meta.getColumnLabel(i), rs.getObject(i));
                            rows.add(row);
                        }
                        sendList(res, rows, rows.size());
                    }
                }

                default -> sendError(res, 404, "Unknown function path: " + path);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    private int parseIntParam(HttpServletRequest req, String name, int defaultVal) {
        String v = req.getParameter(name);
        if (v == null || v.isBlank()) return defaultVal;
        try { return Integer.parseInt(v.trim()); }
        catch (NumberFormatException e) { return defaultVal; }
    }
}
