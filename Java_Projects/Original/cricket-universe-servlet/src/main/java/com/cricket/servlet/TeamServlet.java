package com.cricket.servlet;

import com.cricket.dao.TeamDAO;
import com.cricket.model.Team;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * REST endpoints for the teams resource.
 *
 * GET    /api/teams              → list (optional ?leagueId=)
 * POST   /api/teams              → create
 * GET    /api/teams/{id}         → single
 * PUT    /api/teams/{id}         → update
 * DELETE /api/teams/{id}         → delete
 */
@WebServlet(urlPatterns = "/api/teams/*")
public class TeamServlet extends BaseServlet {

    private final TeamDAO dao = new TeamDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String leagueId = req.getParameter("leagueId");
                List<Team> list = dao.findAll(leagueId);
                sendList(res, list, list.size());
            } else {
                Team t = dao.findById(id);
                if (t == null) sendError(res, 404, "Team not found: " + id);
                else           sendSuccess(res, t);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Team t = parseBody(req, Team.class);
        if (t == null || t.getId() == null || t.getName() == null || t.getLeagueId() == null) {
            sendError(res, 400, "Request body must include id, name and leagueId");
            return;
        }
        try {
            boolean ok = dao.insert(t);
            if (ok) sendCreated(res, t);
            else    sendError(res, 500, "Insert had no effect");
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/teams/{id}"); return; }

        Team t = parseBody(req, Team.class);
        if (t == null || t.getName() == null) {
            sendError(res, 400, "Request body must include name");
            return;
        }
        try {
            boolean ok = dao.update(id, t);
            if (ok) sendSuccess(res, dao.findById(id));
            else    sendError(res, 404, "Team not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/teams/{id}"); return; }
        try {
            boolean ok = dao.delete(id);
            if (ok) sendNoContent(res);
            else    sendError(res, 404, "Team not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
