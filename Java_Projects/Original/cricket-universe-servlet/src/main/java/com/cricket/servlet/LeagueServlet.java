package com.cricket.servlet;

import com.cricket.dao.LeagueDAO;
import com.cricket.model.League;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * REST endpoints for the leagues resource.
 *
 * GET    /api/leagues            → list (optional ?countryId= &search=)
 * POST   /api/leagues            → create
 * GET    /api/leagues/{id}       → single
 * PUT    /api/leagues/{id}       → update
 * DELETE /api/leagues/{id}       → delete
 */
@WebServlet(urlPatterns = "/api/leagues/*")
public class LeagueServlet extends BaseServlet {

    private final LeagueDAO dao = new LeagueDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String countryId = req.getParameter("countryId");
                String search    = req.getParameter("search");
                List<League> list = dao.findAll(countryId, search);
                sendList(res, list, list.size());
            } else {
                League l = dao.findById(id);
                if (l == null) sendError(res, 404, "League not found: " + id);
                else           sendSuccess(res, l);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        League l = parseBody(req, League.class);
        if (l == null || l.getId() == null || l.getName() == null || l.getCountryId() == null) {
            sendError(res, 400, "Request body must include id, name and countryId");
            return;
        }
        try {
            boolean ok = dao.insert(l);
            if (ok) sendCreated(res, l);
            else    sendError(res, 500, "Insert had no effect");
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/leagues/{id}"); return; }

        League l = parseBody(req, League.class);
        if (l == null || l.getName() == null) {
            sendError(res, 400, "Request body must include name");
            return;
        }
        try {
            boolean ok = dao.update(id, l);
            if (ok) sendSuccess(res, dao.findById(id));
            else    sendError(res, 404, "League not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/leagues/{id}"); return; }
        try {
            boolean ok = dao.delete(id);
            if (ok) sendNoContent(res);
            else    sendError(res, 404, "League not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
