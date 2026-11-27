package com.cricket.servlet;

import com.cricket.config.DBConnection;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.*;
import java.util.*;

/**
 * Read-only API over the three MySQL views.
 *
 * GET /api/views/countries-leagues  → v_countries_leagues
 * GET /api/views/teams-players      → v_teams_players
 * GET /api/views/all-players        → v_all_players_detail
 *
 * The view name is selected from a fixed switch — user input never touches SQL.
 */
@WebServlet(urlPatterns = "/api/views/*")
public class ViewServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (path == null || path.equals("/")) {
            sendError(res, 400,
                "Specify a view: /api/views/countries-leagues | teams-players | all-players");
            return;
        }

        String viewName = switch (path) {
            case "/countries-leagues" -> "v_countries_leagues";
            case "/teams-players"     -> "v_teams_players";
            case "/all-players"       -> "v_all_players_detail";
            default -> null;
        };

        if (viewName == null) { sendError(res, 404, "Unknown view: " + path); return; }

        // viewName is always one of 3 fixed strings — never user-supplied
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("SELECT * FROM " + viewName);
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
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
