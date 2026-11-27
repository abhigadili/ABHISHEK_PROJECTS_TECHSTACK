package com.cricket.servlet;

import com.cricket.dao.CricketerDAO;
import com.cricket.model.Cricketer;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * REST endpoints for the cricketers resource.
 *
 * GET    /api/cricketers         → list (optional ?teamId= &role=)
 * POST   /api/cricketers         → create
 * GET    /api/cricketers/{id}    → single
 * PUT    /api/cricketers/{id}    → update
 * DELETE /api/cricketers/{id}    → delete
 */
@WebServlet(urlPatterns = "/api/cricketers/*")
public class CricketerServlet extends BaseServlet {

    private final CricketerDAO dao = new CricketerDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String teamId = req.getParameter("teamId");
                String role   = req.getParameter("role");
                List<Cricketer> list = dao.findAll(teamId, role);
                sendList(res, list, list.size());
            } else {
                Cricketer cr = dao.findById(id);
                if (cr == null) sendError(res, 404, "Cricketer not found: " + id);
                else            sendSuccess(res, cr);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Cricketer cr = parseBody(req, Cricketer.class);
        if (cr == null || cr.getId() == null || cr.getName() == null || cr.getTeamId() == null) {
            sendError(res, 400, "Request body must include id, name and teamId");
            return;
        }
        try {
            boolean ok = dao.insert(cr);
            if (ok) sendCreated(res, cr);
            else    sendError(res, 500, "Insert had no effect");
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/cricketers/{id}"); return; }

        Cricketer cr = parseBody(req, Cricketer.class);
        if (cr == null || cr.getName() == null) {
            sendError(res, 400, "Request body must include name");
            return;
        }
        try {
            boolean ok = dao.update(id, cr);
            if (ok) sendSuccess(res, dao.findById(id));
            else    sendError(res, 404, "Cricketer not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/cricketers/{id}"); return; }
        try {
            boolean ok = dao.delete(id);
            if (ok) sendNoContent(res);
            else    sendError(res, 404, "Cricketer not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
