package com.fooddelivery.common.web;

import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * A plain Jakarta {@link HttpServlet} registered inside the embedded Tomcat (alongside Spring's DispatcherServlet).
 * It exists to show the servlet foundation Spring MVC is built on:
 * lifecycle (init/service/destroy), ServletConfig, ServletContext, request parameters/attributes, response headers,
 * cookies, session handling (we deliberately do NOT create one: the API is stateless), RequestDispatcher forward
 * and redirect.
 *
 * <pre>
 *   GET /servlet/info                 -> JSON about the servlet, container, request
 *   GET /servlet/info?forward=health  -> RequestDispatcher.forward to /actuator/health (same request, server side)
 *   GET /servlet/info?redirect=info   -> HTTP 302 to /actuator/info (client side)
 * </pre>
 */
public class ServiceInfoServlet extends HttpServlet {
    private static final Logger log = LoggerFactory.getLogger(ServiceInfoServlet.class);
    private final AtomicLong hits = new AtomicLong();
    private volatile String serviceName = "unknown";

    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);                                           // lifecycle: called once by the container
        this.serviceName = config.getInitParameter("service-name");   // ServletConfig = per-servlet parameters
        log.info("ServiceInfoServlet.init() for {} on context '{}'", serviceName, config.getServletContext().getContextPath());
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        hits.incrementAndGet();
        String forward = req.getParameter("forward");                 // request parameter
        String redirect = req.getParameter("redirect");
        if ("health".equals(forward)) {
            req.setAttribute("forwardedBy", "ServiceInfoServlet");    // request attribute travels with a forward
            req.getRequestDispatcher("/actuator/health").forward(req, resp);
            return;
        }
        if ("info".equals(redirect)) {
            resp.sendRedirect("/actuator/info");                      // client round-trip
            return;
        }
        ServletContext ctx = getServletContext();                     // ServletContext = application-wide
        HttpSession existing = req.getSession(false);                 // never create: stateless API
        long visits = 0;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("food_visits".equals(c.getName())) {
                    try { visits = Long.parseLong(c.getValue()); } catch (NumberFormatException ignored) { }
                }
            }
        }
        Cookie cookie = new Cookie("food_visits", String.valueOf(visits + 1));
        cookie.setHttpOnly(true);
        cookie.setPath("/servlet");
        cookie.setMaxAge(3600);
        resp.addCookie(cookie);
        resp.setHeader("X-Served-By", serviceName);                   // response header
        resp.setContentType("application/json");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", serviceName);
        body.put("servletName", getServletName());
        body.put("serverInfo", ctx.getServerInfo());
        body.put("servletApi", ctx.getEffectiveMajorVersion() + "." + ctx.getEffectiveMinorVersion());
        body.put("method", req.getMethod());
        body.put("requestUri", req.getRequestURI());
        body.put("queryString", req.getQueryString());
        body.put("remoteAddr", req.getRemoteAddr());
        body.put("sessionCreated", existing != null);
        body.put("hitsSinceStart", hits.get());
        body.put("cookieVisits", visits);
        body.put("now", Instant.now().toString());
        resp.getWriter().write(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(body));
    }

    @Override
    public void destroy() {
        log.info("ServiceInfoServlet.destroy() after {} hits", hits.get());   // lifecycle: called once on shutdown
    }
}
