package com.cricket.servlet;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Shared base for all API servlets.
 *
 * CORS headers are set on every response so the React frontend
 * (running on a different port) can call this API without being blocked
 * by the browser's Same-Origin Policy.
 */
public abstract class BaseServlet extends HttpServlet {

    protected static final Gson GSON = new GsonBuilder().serializeNulls().create();

    // ── CORS ─────────────────────────────────────────────────────────────────
    protected void addCorsHeaders(HttpServletResponse res) {
        res.setHeader("Access-Control-Allow-Origin",  "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    /** Handles the browser preflight OPTIONS request that precedes cross-origin PUT/POST/DELETE. */
    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse res) throws IOException {
        addCorsHeaders(res);
        res.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    // ── JSON response helpers ─────────────────────────────────────────────────
    protected void sendJson(HttpServletResponse res, int status, Object body) throws IOException {
        addCorsHeaders(res);
        res.setStatus(status);
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        try (PrintWriter w = res.getWriter()) {
            w.write(GSON.toJson(body));
        }
    }

    protected void sendSuccess(HttpServletResponse res, Object data) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data",    data);
        sendJson(res, 200, body);
    }

    protected void sendCreated(HttpServletResponse res, Object data) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data",    data);
        sendJson(res, 201, body);
    }

    protected void sendList(HttpServletResponse res, Object list, int total) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data",    list);
        body.put("total",   total);
        sendJson(res, 200, body);
    }

    protected void sendError(HttpServletResponse res, int status, String message) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error",   message);
        sendJson(res, status, body);
    }

    protected void sendNoContent(HttpServletResponse res) {
        addCorsHeaders(res);
        res.setStatus(204);
    }

    // ── Path helpers ──────────────────────────────────────────────────────────
    /** Extracts {id} from /api/resource/{id}; returns null for collection URLs. */
    protected String extractId(HttpServletRequest req) {
        String path = req.getPathInfo();
        if (path == null || path.equals("/") || path.isBlank()) return null;
        return path.startsWith("/") ? path.substring(1) : path;
    }

    // ── Request body parser ───────────────────────────────────────────────────
    protected <T> T parseBody(HttpServletRequest req, Class<T> type) throws IOException {
        try (InputStreamReader r = new InputStreamReader(req.getInputStream(), StandardCharsets.UTF_8)) {
            return GSON.fromJson(r, type);
        }
    }
}
