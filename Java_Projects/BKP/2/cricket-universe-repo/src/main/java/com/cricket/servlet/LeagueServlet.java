package com.cricket.servlet;

import com.cricket.model.League;
import com.cricket.service.LeagueService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * GET    /api/leagues             → list (optional ?countryId= &search=)
 * POST   /api/leagues             → create
 * GET    /api/leagues/{id}        → single
 * PUT    /api/leagues/{id}        → update
 * DELETE /api/leagues/{id}        → delete
 */
@WebServlet(urlPatterns = "/api/leagues/*")
public class LeagueServlet extends BaseServlet {

    private final LeagueService service = new LeagueService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String countryId = req.getParameter("countryId");
                String search    = req.getParameter("search");
                List<League> list = service.getByCountry(countryId, search);
                sendList(res, list, list.size());
            } else {
                Optional<League> opt = service.getById(id);
                if (opt.isPresent()) sendSuccess(res, opt.get());
                else                 sendError(res, 404, "League not found: " + id);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        League l = parseBody(req, League.class);
        if (l == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            sendCreated(res, service.create(l));
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/leagues/{id}"); return; }
        League l = parseBody(req, League.class);
        if (l == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            Optional<League> updated = service.update(id, l);
            if (updated.isPresent()) sendSuccess(res, updated.get());
            else                     sendError(res, 404, "League not found: " + id);
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/leagues/{id}"); return; }
        try {
            if (service.delete(id)) sendNoContent(res);
            else                    sendError(res, 404, "League not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
