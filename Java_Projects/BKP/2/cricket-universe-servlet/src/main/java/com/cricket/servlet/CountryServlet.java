package com.cricket.servlet;

import com.cricket.dao.CountryDAO;
import com.cricket.model.Country;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * REST endpoints for the countries resource.
 *
 * GET    /api/countries          → list (optional ?search=)
 * POST   /api/countries          → create
 * GET    /api/countries/{id}     → single
 * PUT    /api/countries/{id}     → update
 * DELETE /api/countries/{id}     → delete
 */
@WebServlet(urlPatterns = "/api/countries/*")
public class CountryServlet extends BaseServlet {

    private final CountryDAO dao = new CountryDAO();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String search = req.getParameter("search");
                List<Country> list = dao.findAll(search);
                sendList(res, list, list.size());
            } else {
                Country c = dao.findById(id);
                if (c == null) sendError(res, 404, "Country not found: " + id);
                else           sendSuccess(res, c);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Country c = parseBody(req, Country.class);
        if (c == null || c.getId() == null || c.getName() == null) {
            sendError(res, 400, "Request body must include id and name");
            return;
        }
        try {
            boolean ok = dao.insert(c);
            if (ok) sendCreated(res, c);
            else    sendError(res, 500, "Insert had no effect");
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/countries/{id}"); return; }

        Country c = parseBody(req, Country.class);
        if (c == null || c.getName() == null) {
            sendError(res, 400, "Request body must include name");
            return;
        }
        try {
            boolean ok = dao.update(id, c);
            if (ok) sendSuccess(res, dao.findById(id));
            else    sendError(res, 404, "Country not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/countries/{id}"); return; }
        try {
            boolean ok = dao.delete(id);
            if (ok) sendNoContent(res);
            else    sendError(res, 404, "Country not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
