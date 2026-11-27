package com.cricket.servlet;

import com.cricket.model.Country;
import com.cricket.service.CountryService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * REST endpoints for the countries resource.
 * Delegates all logic to CountryService — no SQL, no repository, no JDBC here.
 *
 * GET    /api/countries          → list (optional ?search=)
 * POST   /api/countries          → create
 * GET    /api/countries/{id}     → single
 * PUT    /api/countries/{id}     → update
 * DELETE /api/countries/{id}     → delete
 */
@WebServlet(urlPatterns = "/api/countries/*")
public class CountryServlet extends BaseServlet {

    private final CountryService service = new CountryService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        try {
            if (id == null) {
                String search = req.getParameter("search");
                List<Country> list = (search == null || search.isBlank())
                    ? service.getAll() : service.search(search);
                sendList(res, list, list.size());
            } else {
                Optional<Country> opt = service.getById(id);
                if (opt.isPresent()) sendSuccess(res, opt.get());
                else                 sendError(res, 404, "Country not found: " + id);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res) throws IOException {
        Country c = parseBody(req, Country.class);
        if (c == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            sendCreated(res, service.create(c));
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "PUT requires /api/countries/{id}"); return; }
        Country c = parseBody(req, Country.class);
        if (c == null) { sendError(res, 400, "Request body is required"); return; }
        try {
            Optional<Country> updated = service.update(id, c);
            if (updated.isPresent()) sendSuccess(res, updated.get());
            else                     sendError(res, 404, "Country not found: " + id);
        } catch (IllegalArgumentException e) {
            sendError(res, 400, e.getMessage());
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);
        if (id == null) { sendError(res, 400, "DELETE requires /api/countries/{id}"); return; }
        try {
            if (service.delete(id)) sendNoContent(res);
            else                    sendError(res, 404, "Country not found: " + id);
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
}
