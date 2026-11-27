package com.cricket.servlet;

import com.cricket.model.Team;
import com.cricket.service.TeamService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * GET    /api/teams              → list (optional ?leagueId=)
 * POST   /api/teams              → create
 * GET    /api/teams/{id}         → single
 * PUT    /api/teams/{id}         → update
 * DELETE /api/teams/{id}         → delete
 */
@WebServlet(urlPatterns = "/api/teams/*")
public class TeamServlet extends BaseServlet {

    private final TeamService service = new TeamService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String leagueId = req.getParameter("leagueId");
                List<Team> list = service.getByLeague(leagueId);
                sendList(res, list, list.size());
            } else {
                Optional<Team> opt = service.getById(id);
                if (opt.isPresent()) sendSuccess(res, opt.get());
                else                 sendError(res, 404, "Team not found: " + id);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Team t = parseBody(req, Team.class);
        if (t == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            sendCreated(res, service.create(t));
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/teams/{id}"); return; }
        Team t = parseBody(req, Team.class);
        if (t == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            Optional<Team> updated = service.update(id, t);
            if (updated.isPresent()) sendSuccess(res, updated.get());
            else                     sendError(res, 404, "Team not found: " + id);
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/teams/{id}"); return; }
        try {
            if (service.delete(id)) sendNoContent(res);
            else                    sendError(res, 404, "Team not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
