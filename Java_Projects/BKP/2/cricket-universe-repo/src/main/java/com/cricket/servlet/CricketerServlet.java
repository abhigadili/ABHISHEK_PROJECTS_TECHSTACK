package com.cricket.servlet;

import com.cricket.model.Cricketer;
import com.cricket.service.CricketerService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * GET    /api/cricketers          → list (optional ?teamId= &role=)
 * POST   /api/cricketers          → create
 * GET    /api/cricketers/{id}     → single
 * PUT    /api/cricketers/{id}     → update
 * DELETE /api/cricketers/{id}     → delete
 */
@WebServlet(urlPatterns = "/api/cricketers/*")
public class CricketerServlet extends BaseServlet {

    private final CricketerService service = new CricketerService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String teamId = req.getParameter("teamId");
                String role   = req.getParameter("role");
                List<Cricketer> list = service.getByTeamAndRole(teamId, role);
                sendList(res, list, list.size());
            } else {
                Optional<Cricketer> opt = service.getById(id);
                if (opt.isPresent()) sendSuccess(res, opt.get());
                else                 sendError(res, 404, "Cricketer not found: " + id);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Cricketer cr = parseBody(req, Cricketer.class);
        if (cr == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            sendCreated(res, service.create(cr));
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/cricketers/{id}"); return; }
        Cricketer cr = parseBody(req, Cricketer.class);
        if (cr == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            Optional<Cricketer> updated = service.update(id, cr);
            if (updated.isPresent()) sendSuccess(res, updated.get());
            else                     sendError(res, 404, "Cricketer not found: " + id);
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/cricketers/{id}"); return; }
        try {
            if (service.delete(id)) sendNoContent(res);
            else                    sendError(res, 404, "Cricketer not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
