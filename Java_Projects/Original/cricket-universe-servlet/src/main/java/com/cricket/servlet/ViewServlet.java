package com.cricket.servlet;

import com.cricket.config.DBConnection;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.*;
import java.util.*;

/**
 * Exposes the three MySQL views as read-only API endpoints.
 *
 * GET /api/views/countries-leagues  → v_countries_leagues
 * GET /api/views/teams-players      → v_teams_players
 * GET /api/views/all-players        → v_all_players_detail
 */
@WebServlet(urlPatterns = "/api/views/*")
public class ViewServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();   // e.g. "/countries-leagues"
        if (path == null || path.equals("/")) {
            sendError(res, 400,
                "Specify a view: /api/views/countries-leagues | /api/views/teams-players | /api/views/all-players");
            return;
        }

        String viewName = switch (path) {
            case "/countries-leagues" -> "v_countries_leagues";
            case "/teams-players"     -> "v_teams_players";
            case "/all-players"       -> "v_all_players_detail";
            default -> null;
        };

        if (viewName == null) {
            sendError(res, 404, "Unknown view: " + path);
            return;
        }

        // Safe: viewName comes from the switch above, never from user input
        String sql = "SELECT * FROM " + viewName;
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            ResultSetMetaData meta = rs.getMetaData();
            int cols = meta.getColumnCount();
            List<Map<String, Object>> rows = new ArrayList<>();

            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= cols; i++) {
                    row.put(meta.getColumnLabel(i), rs.getObject(i));
                }
                rows.add(row);
            }
            sendList(res, rows, rows.size());

        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
