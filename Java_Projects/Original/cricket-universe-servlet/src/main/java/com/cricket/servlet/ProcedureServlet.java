package com.cricket.servlet;

import com.cricket.config.DBConnection;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.*;
import java.util.*;

/**
 * Calls all 8 stored procedures via CallableStatement.
 *
 * GET /api/procedures/list-countries       ?search=
 * GET /api/procedures/list-leagues         ?countryId= &search=
 * GET /api/procedures/list-teams           ?leagueId=
 * GET /api/procedures/list-players         ?teamId= &role=
 * GET /api/procedures/all-players-detail
 * GET /api/procedures/cursor-role-totals
 * GET /api/procedures/window-functions
 * GET /api/procedures/analytics
 */
@WebServlet(urlPatterns = "/api/procedures/*")
public class ProcedureServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (path == null || path.equals("/")) {
            sendError(res, 400, "Specify a procedure path. Available: " +
                "list-countries | list-leagues | list-teams | list-players | " +
                "all-players-detail | cursor-role-totals | window-functions | analytics");
            return;
        }

        try (Connection con = DBConnection.getConnection()) {
            switch (path) {

                case "/list-countries" -> {
                    String search = nullIfBlank(req.getParameter("search"));
                    sendList(res, callResultSet(con, "{CALL sp_list_countries(?)}", search), -1);
                }
                case "/list-leagues" -> {
                    String countryId = nullIfBlank(req.getParameter("countryId"));
                    String search    = nullIfBlank(req.getParameter("search"));
                    sendList(res, callResultSet(con, "{CALL sp_list_leagues(?,?)}", countryId, search), -1);
                }
                case "/list-teams" -> {
                    String leagueId = nullIfBlank(req.getParameter("leagueId"));
                    sendList(res, callResultSet(con, "{CALL sp_list_teams(?)}", leagueId), -1);
                }
                case "/list-players" -> {
                    String teamId = nullIfBlank(req.getParameter("teamId"));
                    String role   = nullIfBlank(req.getParameter("role"));
                    sendList(res, callResultSet(con, "{CALL sp_list_players(?,?)}", teamId, role), -1);
                }
                case "/all-players-detail" ->
                    sendList(res, callResultSet(con, "{CALL sp_all_players_detail()}"), -1);

                case "/cursor-role-totals" ->
                    sendList(res, callResultSet(con, "{CALL sp_cursor_role_run_totals()}"), -1);

                case "/window-functions" ->
                    sendList(res, callResultSet(con, "{CALL sp_window_functions_demo()}"), -1);

                case "/analytics" ->
                    sendList(res, callResultSet(con, "{CALL sp_analytics_demo()}"), -1);

                default -> sendError(res, 404, "Unknown procedure: " + path);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    /** Executes a CALL statement with positional parameters and returns all rows of the first ResultSet. */
    private List<Map<String, Object>> callResultSet(Connection con, String call, String... params)
            throws SQLException {

        List<Map<String, Object>> rows = new ArrayList<>();

        try (CallableStatement cs = con.prepareCall(call)) {
            // Bind each parameter — null maps to SQL NULL (VARCHAR).
            for (int i = 0; i < params.length; i++) {
                if (params[i] == null) cs.setNull(i + 1, Types.VARCHAR);
                else                   cs.setString(i + 1, params[i]);
            }

            boolean hasResultSet = cs.execute();
            if (hasResultSet) {
                try (ResultSet rs = cs.getResultSet()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    int cols = meta.getColumnCount();
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 1; i <= cols; i++) {
                            row.put(meta.getColumnLabel(i), rs.getObject(i));
                        }
                        rows.add(row);
                    }
                }
            }
        }
        return rows;
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
